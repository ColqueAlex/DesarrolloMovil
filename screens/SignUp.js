import React, { useState } from 'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet,Alert,Image,ScrollView,KeyboardAvoidingView,Platform,} from 'react-native';
import { FontAwesome, Feather } from '@expo/vector-icons';
import { auth, db } from '../src/config/firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

export default function SignUp({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignUp = async () => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !dni.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert('Error', 'Todos los campos son obligatorios.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(password)) {
      Alert.alert(
        'Error',
        'La contraseña debe tener al menos 6 caracteres, incluyendo una letra mayúscula, una minúscula y un número.'
      );
      return;
    }

    if (!auth || !db) {
      Alert.alert('Error', 'No se pudo conectar con Firebase. Inténtalo más tarde.');
      return;
    }

    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error('Error de registro:', error.code, error.message);
      let errorMessage = 'Hubo un problema al registrar el usuario.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'El correo electrónico ya está en uso.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'El formato del correo electrónico no es válido.';
          break;
        case 'auth/weak-password':
          errorMessage = 'La contraseña es demasiado débil.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Error de conexión, por favor intenta más tarde.';
          break;
        case 'auth/invalid-api-key':
          errorMessage = 'La clave API de Firebase no es válida. Revisa la configuración.';
          break;
      }
      Alert.alert('Error', `${errorMessage}\n\nCódigo: ${error.code ?? 'desconocido'}`);
      return;
    }

    let nombreAuthenticationGuardado = true;
    try {
      await updateProfile(credential.user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
      });
    } catch (error) {
      console.error('Error al guardar el nombre en Firebase Authentication:', error);
      nombreAuthenticationGuardado = false;
    }

    try {
      const nombreCompleto = `${firstName.trim()} ${lastName.trim()}`;
      await setDoc(doc(db, 'usuarios', credential.user.uid), {
        uid: credential.user.uid,
        nombre: firstName.trim(),
        apellido: lastName.trim(),
        nombreCompleto,
        dni: dni.trim(),
        telefono: phone.trim(),
        email: email.trim(),
        rol: 'usuario',
        createdAt: serverTimestamp(),
      });
      Alert.alert(
        'Registro exitoso',
        nombreAuthenticationGuardado
          ? 'Usuario registrado y guardado en la base de datos.'
          : 'El usuario se guardó en la base de datos, pero no se pudo actualizar su nombre de perfil.',
      );
    } catch (error) {
      console.error('Error al guardar el usuario en Cloud Firestore:', error);
      const errorMessage = error.code === 'permission-denied'
        ? 'Firestore rechazó la escritura. Revisa las reglas de seguridad de la colección usuarios.'
        : 'No se pudo guardar el perfil en Cloud Firestore. Inténtalo de nuevo más tarde.';
      Alert.alert(
        'Cuenta creada, perfil no guardado',
        `${errorMessage}\n\nCódigo: ${error.code ?? 'desconocido'}`,
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screenContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={require('../assets/logo.png')} style={styles.logo} />

        <Text style={styles.mainTitle}>Regístrate</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Nombre</Text>
          <View style={styles.inputBox}>
            <Feather name="user" size={18} color="#EE684D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ingrese su nombre"
              placeholderTextColor="#A0A5AA"
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>

          <Text style={styles.label}>Apellido</Text>
          <View style={styles.inputBox}>
            <Feather name="user" size={18} color="#EE684D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ingrese su apellido"
              placeholderTextColor="#A0A5AA"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <Text style={styles.label}>DNI</Text>
          <View style={styles.inputBox}>
            <Feather name="credit-card" size={18} color="#EE684D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ingrese su DNI"
              placeholderTextColor="#A0A5AA"
              value={dni}
              onChangeText={setDni}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.label}>Número de teléfono</Text>
          <View style={styles.inputBox}>
            <Feather name="phone" size={18} color="#EE684D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ingrese su número de teléfono"
              placeholderTextColor="#A0A5AA"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={20}
            />
          </View>

          <Text style={styles.label}>Correo Electrónico</Text>
          <View style={styles.inputBox}>
            <Feather name="mail" size={18} color="#EE684D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ejemplo@correo.com"
              placeholderTextColor="#A0A5AA"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.inputBox}>
            <Feather name="lock" size={18} color="#6C757D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#A0A5AA"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather
                name={showPassword ? 'eye-off' : 'eye'}
                size={18}
                color="#6C757D"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirmar Contraseña</Text>
          <View style={styles.inputBox}>
            <Feather name="lock" size={18} color="#6C757D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#A0A5AA"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Feather
                name={showConfirmPassword ? 'eye-off' : 'eye'}
                size={18}
                color="#6C757D"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={handleSignUp}>
            <Text style={styles.registerButtonText}>Registrarse</Text>
            <FontAwesome name="arrow-right" size={16} color="#FFF" style={styles.arrowIcon} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.loginContainer}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginText}>
            ¿Ya tienes cuenta? <Text style={styles.loginBoldText}>Inicia sesión</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  logo: {
    width: '75%',
    height: 100,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#EE684D',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#DCDFE1',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
    marginTop: 4,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EE684D',
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#212529',
  },
  registerButton: {
    backgroundColor: '#EE684D',
    borderRadius: 12,
    height: 50,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingHorizontal: 15,
    shadowColor: '#EE684D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  loginContainer: {
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  loginText: {
    color: '#495057',
    fontSize: 14,
  },
  loginBoldText: {
    color: '#EE684D',
    fontWeight: 'bold',
  },
});
