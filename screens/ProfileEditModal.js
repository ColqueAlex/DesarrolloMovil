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
import { verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';
import { formatearDNI, validarEmail, validarTelefonoAR } from '../src/utils/validaciones';

// Se pueden cambiar la foto de perfil, el teléfono y el correo. Nombre,
// apellido y DNI se muestran pero no se pueden editar.
export default function ProfileEditModal({ visible, initialName, onClose, onSaved }) {
  const [fullName, setFullName] = useState('');
  const [readOnlyData, setReadOnlyData] = useState({ nombre: '', apellido: '', dni: '' });
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  // Evita borrar el teléfono guardado si el perfil no se pudo cargar.
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [profileRole, setProfileRole] = useState('usuario');
  const [profileImageUri, setProfileImageUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;

    let cancelled = false;
    const user = auth?.currentUser;
    const startName = initialName || user?.displayName || '';
    const [fallbackFirstName = '', ...fallbackLastName] = startName.split(/\s+/);
    setFullName(startName);
    setReadOnlyData({
      nombre: fallbackFirstName,
      apellido: fallbackLastName.join(' '),
      dni: '',
    });
    setPhone('');
    setPhoneError('');
    setPhoneTouched(false);
    setProfileLoaded(false);
    // El correo vigente es siempre el de Firebase Authentication.
    setEmail(user?.email || '');
    setEmailError('');
    setProfileRole('usuario');
    setProfileImageUri(user?.photoURL || '');

    if (!user || !db) return undefined;

    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const profileSnapshot = await getDoc(doc(db, 'usuarios', user.uid));
        if (cancelled) return;
        setProfileLoaded(true);
        if (!profileSnapshot.exists()) return;

        const profile = profileSnapshot.data();
        const savedName = profile.nombreCompleto
          || [profile.nombre, profile.apellido].filter(Boolean).join(' ');
        if (savedName) setFullName(savedName);
        setReadOnlyData({
          nombre: profile.nombre || fallbackFirstName,
          apellido: profile.apellido || fallbackLastName.join(' '),
          dni: profile.dni || '',
        });
        setPhone(profile.telefono || '');
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
    const trimmedEmail = email.trim().toLowerCase();
    const phoneResult = validarTelefonoAR(phone);
    const trimmedPhone = phoneResult.valor;
    const emailErrorMessage = validarEmail(trimmedEmail);
    if (phoneResult.error) setPhoneError(phoneResult.error);
    if (emailErrorMessage) setEmailError(emailErrorMessage);
    if (phoneResult.error || emailErrorMessage) return;

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

    // 1) Correo: Firebase envía un enlace al correo nuevo y el cambio se
    //    aplica recién cuando la persona lo confirma.
    const emailChanged = trimmedEmail !== String(user.email || '').toLowerCase();
    if (emailChanged) {
      try {
        await verifyBeforeUpdateEmail(user, trimmedEmail);
      } catch (error) {
        console.error('Error al solicitar el cambio de correo:', error);
        let errorMessage = 'No se pudo cambiar el correo electrónico. Inténtalo de nuevo.';
        if (error.code === 'auth/requires-recent-login') {
          errorMessage = 'Por seguridad, cierra sesión e inicia sesión nuevamente antes de cambiar el correo.';
        } else if (error.code === 'auth/email-already-in-use') {
          errorMessage = 'Ese correo electrónico ya está asociado a otra cuenta.';
        } else if (error.code === 'auth/invalid-email' || error.code === 'auth/invalid-new-email') {
          errorMessage = 'El formato del correo electrónico no es válido.';
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = 'Hiciste demasiados intentos. Espera unos minutos e inténtalo otra vez.';
        }
        setEmailError(errorMessage);
        setSaving(false);
        return;
      }
    }

    // 2) Foto y teléfono (más el correo vigente). Nombre, apellido, DNI y rol
    //    no se tocan.
    try {
      await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid,
        rol: profileRole,
        email: user.email,
        ...(profileLoaded || phoneTouched ? { telefono: trimmedPhone } : {}),
        fotoPerfil: profileImageUri || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      onSaved(fullName || initialName, profileImageUri);
      onClose();
      Alert.alert(
        'Perfil actualizado',
        emailChanged
          ? `Te enviamos un enlace a ${trimmedEmail}. Tu correo cambiará cuando lo confirmes desde ese mensaje; mientras tanto sigues entrando con el actual.`
          : 'Tus cambios se guardaron correctamente.',
      );
    } catch (error) {
      console.error('Error al actualizar el perfil en Cloud Firestore:', error);
      Alert.alert(
        'Cambios no guardados',
        `${emailChanged ? 'El enlace para cambiar el correo sí se envió, pero ' : ''}no se pudieron guardar la foto ni el teléfono. Inténtalo de nuevo.\n\nCódigo: ${error.code ?? 'desconocido'}`,
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
                {pickingImage ? 'Abriendo fotos...' : profileImageUri ? 'Cambiar foto' : 'Añadir foto'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.title}>Editar perfil</Text>
            <Text style={styles.description}>Puedes cambiar tu foto, tu teléfono y tu correo electrónico.</Text>

            {loadingProfile ? (
              <View style={styles.loading}>
                <ActivityIndicator color="#1B3A57" />
                <Text style={styles.loadingText}>Cargando perfil...</Text>
              </View>
            ) : null}

            {[
              ['Nombre', readOnlyData.nombre],
              ['Apellido', readOnlyData.apellido],
              ['DNI', formatearDNI(readOnlyData.dni)],
            ].map(([label, value]) => (
              <View key={label}>
                <Text style={styles.label}>{label}</Text>
                <View
                  style={[styles.input, styles.readOnlyInput]}
                  accessible
                  accessibilityLabel={`${label}: ${value || 'sin dato'}. No editable`}
                >
                  <Text style={[styles.readOnlyText, !value && styles.readOnlyEmpty]} numberOfLines={1}>
                    {value || 'Sin dato'}
                  </Text>
                  <Feather name="lock" size={15} color="#94A3B8" />
                </View>
              </View>
            ))}

            <Text style={styles.label}>Número de teléfono</Text>
            <TextInput
              style={[styles.input, phoneError ? styles.inputError : null]}
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setPhoneTouched(true);
                if (phoneError) setPhoneError('');
              }}
              placeholder="Ej.: 11 2345-6789"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={20}
              editable={!saving && !loadingProfile}
              returnKeyType="done"
            />
            {phoneError ? <Text style={[styles.errorText, styles.fieldGap]}>{phoneError}</Text> : null}

            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={[styles.input, emailError ? styles.inputError : null]}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (emailError) setEmailError('');
              }}
              placeholder="ejemplo@correo.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={254}
              editable={!saving && !loadingProfile}
              returnKeyType="done"
            />
            {emailError ? (
              <Text style={styles.errorText}>{emailError}</Text>
            ) : (
              <Text style={styles.helpText}>
                Si lo cambias, te enviaremos un enlace al correo nuevo para confirmarlo.
              </Text>
            )}

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
  readOnlyInput: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readOnlyText: {
    color: '#475569',
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  readOnlyEmpty: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  description: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 22,
  },
  inputError: {
    borderColor: '#C2410C',
  },
  errorText: {
    color: '#C2410C',
    fontSize: 13,
    marginTop: -10,
  },
  fieldGap: {
    marginBottom: 14,
  },
  helpText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: -10,
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
