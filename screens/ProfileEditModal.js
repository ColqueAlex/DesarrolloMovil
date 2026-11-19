import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateEmail, updateProfile } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';

export default function ProfileEditModal({ visible, initialName, onClose, onSaved }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [profileRole, setProfileRole] = useState('usuario');
  const [profileImageUri, setProfileImageUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;

    let cancelled = false;
    const user = auth?.currentUser;
    const [fallbackFirstName = '', ...fallbackLastName] = (initialName || '').split(/\s+/);
    setFirstName(fallbackFirstName);
    setLastName(fallbackLastName.join(' '));
    setPhone('');
    setEmail(user?.email || '');
    setProfileRole('usuario');
    setProfileImageUri(user?.photoURL || '');

    if (!user || !db) return undefined;

    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const profileSnapshot = await getDoc(doc(db, 'usuarios', user.uid));
        if (cancelled || !profileSnapshot.exists()) return;

        const profile = profileSnapshot.data();
        setFirstName(profile.nombre || fallbackFirstName);
        setLastName(profile.apellido || fallbackLastName.join(' '));
        setPhone(profile.telefono || '');
        setEmail(profile.email || user.email || '');
        setProfileRole(profile.rol === 'administrador' ? 'administrador' : 'usuario');
        setProfileImageUri(profile.fotoPerfil || user.photoURL || '');
      } catch (error) {
        console.error('Error al cargar el perfil desde Cloud Firestore:', error);
        if (!cancelled) {
          Alert.alert(
            'No se pudo cargar el perfil',
            'Se mostrarán los datos disponibles de la cuenta. Revisa las reglas de Firestore si el problema continúa.',
          );
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [initialName, visible]);

  const chooseProfileImage = async () => {
    setPickingImage(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permiso necesario', 'Permite el acceso a tus fotos para elegir una imagen de perfil.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setProfileImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error al elegir la foto de perfil:', error);
      Alert.alert('No se pudo elegir la foto', 'Inténtalo de nuevo.');
    } finally {
      setPickingImage(false);
    }
  };

  const saveProfile = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail) {
      Alert.alert('Datos requeridos', 'Ingresa nombre, apellido y correo electrónico.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }

    const user = auth?.currentUser;
    if (!user) {
      Alert.alert('Error', 'No se encontró una sesión activa. Inicia sesión nuevamente.');
      return;
    }
    if (!db) {
      Alert.alert('Error', 'No se pudo conectar con Cloud Firestore. Inténtalo de nuevo.');
      return;
    }

    setSaving(true);
    let emailUpdated = false;
    try {
      if (trimmedEmail !== user.email) {
        await updateEmail(user, trimmedEmail);
        emailUpdated = true;
      }
    } catch (error) {
      console.error('Error al actualizar el correo en Firebase Authentication:', error);
      let errorMessage = 'No se pudo actualizar el correo electrónico.';
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Por seguridad, cierra sesión e inicia sesión nuevamente antes de cambiar el correo.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Ese correo electrónico ya está asociado a otra cuenta.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El formato del correo electrónico no es válido.';
      }
      Alert.alert('No se pudo actualizar el correo', errorMessage);
      setSaving(false);
      return;
    }

    let authNameUpdated = true;
    try {
      await updateProfile(user, {
        displayName: `${trimmedFirstName} ${trimmedLastName}`,
      });
    } catch (error) {
      authNameUpdated = false;
      console.error('Error al actualizar el nombre en Firebase Authentication:', error);
    }

    try {
      await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid,
        nombre: trimmedFirstName,
        apellido: trimmedLastName,
        nombreCompleto: `${trimmedFirstName} ${trimmedLastName}`,
        telefono: trimmedPhone,
        email: trimmedEmail,
        rol: profileRole,
        fotoPerfil: profileImageUri || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      onSaved(`${trimmedFirstName} ${trimmedLastName}`, profileImageUri);
      onClose();
      Alert.alert(
        'Perfil actualizado',
        authNameUpdated
          ? 'Tus datos se guardaron correctamente.'
          : 'Los datos se guardaron en Firestore, pero no se pudo actualizar el nombre de la cuenta.',
      );
    } catch (error) {
      console.error('Error al actualizar el perfil en Cloud Firestore:', error);
      Alert.alert(
        emailUpdated
          ? 'Correo actualizado, perfil no guardado'
          : 'Perfil no guardado',
        `No se pudieron guardar los datos en Cloud Firestore. Revisa las reglas de seguridad de usuarios e inténtalo de nuevo.\n\nCódigo: ${error.code ?? 'desconocido'}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={chooseProfileImage}
              disabled={saving || loadingProfile || pickingImage}
              accessibilityRole="button"
              accessibilityLabel={profileImageUri ? 'Cambiar foto de perfil' : 'Añadir foto de perfil'}
            >
              <View style={styles.avatar}>
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
                ) : (
                  <Feather name="user" size={40} color="#64748B" />
                )}
                <View style={styles.cameraBadge}>
                  {pickingImage ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="camera" size={15} color="#FFFFFF" />
                  )}
                </View>
              </View>
              <Text style={styles.photoLabel}>
                {pickingImage ? 'Abriendo fotos...' : 'Añadir foto'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.title}>Editar perfil</Text>
            <Text style={styles.description}>Actualiza la información de tu cuenta.</Text>

            {loadingProfile ? (
              <View style={styles.loading}>
                <ActivityIndicator color="#1B3A57" />
                <Text style={styles.loadingText}>Cargando perfil...</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Tu nombre"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              maxLength={60}
              editable={!saving && !loadingProfile}
              returnKeyType="done"
            />

            <Text style={styles.label}>Apellido</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Tu apellido"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              maxLength={60}
              editable={!saving && !loadingProfile}
              returnKeyType="done"
            />

            <Text style={styles.label}>Número de teléfono</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Tu número de teléfono"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={20}
              editable={!saving && !loadingProfile}
              returnKeyType="done"
            />

            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ejemplo@correo.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={254}
              editable={!saving && !loadingProfile}
              returnKeyType="done"
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={saving}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, saving && styles.disabledButton]}
                onPress={saveProfile}
                disabled={saving || loadingProfile}
                accessibilityRole="button"
              >
                <Text style={styles.saveText}>
                  {loadingProfile ? 'Cargando...' : saving ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    elevation: 8,
  },
  title: {
    color: '#1B3A57',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  avatarButton: {
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
    borderRadius: 52,
    borderWidth: 1,
    height: 104,
    justifyContent: 'center',
    width: 104,
  },
  avatarImage: {
    borderRadius: 52,
    height: '100%',
    width: '100%',
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: '#1B3A57',
    borderColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    bottom: 0,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 32,
  },
  photoLabel: {
    color: '#1B3A57',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  description: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 22,
  },
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 18,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    marginLeft: 10,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1,
    color: '#1E293B',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  button: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    minWidth: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelButton: {
    marginRight: 10,
  },
  cancelText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#1B3A57',
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
