import React, { useState } from 'react';
import {
  View,Text,TextInput,TouchableOpacity,StyleSheet, Alert,Image,ScrollView,KeyboardAvoidingView,Platform,} from 'react-native';
import { FontAwesome, Feather } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

export default function Login({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Por favor ingrese ambos campos.');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      Alert.alert('Login exitoso', 'Has iniciado sesión correctamente.');
    } catch (error) {
      console.error('Error de inicio de sesión:', error.code, error.message);
      let errorMessage = 'Hubo un problema al iniciar sesión.';
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'El formato del correo electrónico no es válido.';
          break;
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          errorMessage = 'La contraseña es incorrecta.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No se encontró un usuario con este correo.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Error de conexión, por favor intenta más tarde.';
          break;
        case 'auth/invalid-api-key':
          errorMessage = 'La clave API de Firebase no es válida. Revisa tu configuración.';
          break;
      }
      Alert.alert('Error', `${errorMessage}\n\nCódigo: ${error.code ?? 'desconocido'}`);
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

        <Text style={styles.mainTitle}>Bienvenido</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Correo de usuario</Text>
          <View style={styles.inputBox}>
            <Feather name="user" size={18} color="#E06D53" style={styles.inputIcon} />
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

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Iniciar sesión</Text>
            <FontAwesome name="arrow-right" size={16} color="#FFF" style={styles.arrowIcon} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signUpContainer}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.signUpText}>
            ¿No tienes cuenta aún? <Text style={styles.signUpBoldText}>Regístrate aquí</Text>
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
    justify: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  logo: {
    width: '75%',
    height: 110,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 42,
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
    marginTop: 6,
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
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#212529',
  },
  loginButton: {
    backgroundColor: '#EE684D', 
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#EE684D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 18,
  },
  forgotPasswordText: {
    color: '#495057',
    fontSize: 13,
    fontWeight: '500',
  },
  signUpContainer: {
    marginTop: 25,
    paddingVertical: 10,
  },
  signUpText: {
    color: '#495057',
    fontSize: 14,
  },
  signUpBoldText: {
    color: '#EE684D',
    fontWeight: 'bold',
  },
});