import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

export default function Login({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);

  // Estados para errores profesionales en pantalla
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [generalError, setGeneralError] = useState('');

  const validateFields = () => {
    let valid = true;
    const errors = { email: '', password: '' };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      errors.email = 'Por favor, ingresa tu correo electrónico.';
      valid = false;
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'El formato del correo no es válido (ej. usuario@correo.com).';
      valid = false;
    }

    if (!password) {
      errors.password = 'Por favor, ingresa tu contraseña.';
      valid = false;
    } else if (password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres.';
      valid = false;
    }

    setFieldErrors(errors);
    return valid;
  };

  const handleLogin = async () => {
    setGeneralError('');

    // 1. Validar campos antes de llamar a Firebase
    if (!validateFields()) {
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // El observador de Firebase redirige automáticamente a Home
    } catch (error) {
      // Usamos console.log para no disparar el banner rojo de Expo Go
      console.log('Aviso de autenticación:', error.code);

      switch (error.code) {
        case 'auth/invalid-email':
          setFieldErrors((prev) => ({
            ...prev,
            email: 'El formato del correo electrónico no es válido.',
          }));
          break;
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          setGeneralError(
            'El correo o la contraseña son incorrectos. Verifica tus datos e intenta nuevamente.'
          );
          break;
        case 'auth/too-many-requests':
          setGeneralError(
            'Demasiados intentos fallidos. Por seguridad, espera unos minutos antes de volver a intentar.'
          );
          break;
        case 'auth/user-disabled':
          setGeneralError(
            'Esta cuenta ha sido deshabilitada. Contacta al administrador del sistema.'
          );
          break;
        case 'auth/network-request-failed':
          setGeneralError(
            'Sin conexión a internet. Verifica tu red e intenta nuevamente.'
          );
          break;
        default:
          setGeneralError(
            'No se pudo iniciar sesión en este momento. Intenta nuevamente más tarde.'
          );
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (text) => {
    setEmail(text);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
    if (generalError) setGeneralError('');
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
    if (generalError) setGeneralError('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screenContainer}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F2F6F4" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cabecera curva superior con logo */}
        <View style={styles.headerContainer}>
          <Image source={require('../assets/logo.png')} style={styles.logo} />
        </View>

        {/* Cuerpo principal */}
        <View style={styles.bodyContainer}>
          <View>
            <Text style={styles.mainTitle}>Bienvenido</Text>
            <Text style={styles.subtitle}>Ingresa tus credenciales para acceder</Text>

            {/* Banner de error general (Credenciales incorrectas, red, etc.) */}
            {generalError ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={18} color="#DC2626" style={styles.bannerIcon} />
                <Text style={styles.errorBannerText}>{generalError}</Text>
              </View>
            ) : null}

            {/* Campo Correo electrónico */}
            <Text style={styles.label}>Correo electrónico</Text>
            <View
              style={[
                styles.inputBox,
                focusedField === 'email' && styles.inputBoxFocused,
                fieldErrors.email && styles.inputBoxError,
              ]}
            >
              <Feather
                name="mail"
                size={18}
                color={
                  fieldErrors.email
                    ? '#DC2626'
                    : focusedField === 'email'
                    ? '#EE684D'
                    : '#94A3B8'
                }
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="ejemplo@correo.com"
                placeholderTextColor="#64748B"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {fieldErrors.email ? (
              <View style={styles.inlineErrorRow}>
                <Feather name="info" size={13} color="#DC2626" />
                <Text style={styles.inlineErrorText}>{fieldErrors.email}</Text>
              </View>
            ) : null}

            {/* Campo Contraseña */}
            <Text style={styles.label}>Contraseña</Text>
            <View
              style={[
                styles.inputBox,
                focusedField === 'password' && styles.inputBoxFocused,
                fieldErrors.password && styles.inputBoxError,
              ]}
            >
              <Feather
                name="lock"
                size={18}
                color={
                  fieldErrors.password
                    ? '#DC2626'
                    : focusedField === 'password'
                    ? '#EE684D'
                    : '#94A3B8'
                }
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor="#64748B"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>
            {fieldErrors.password ? (
              <View style={styles.inlineErrorRow}>
                <Feather name="info" size={13} color="#DC2626" />
                <Text style={styles.inlineErrorText}>{fieldErrors.password}</Text>
              </View>
            ) : null}

            {/* Enlace Olvidaste tu contraseña */}
            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            {/* Botón Iniciar Sesión */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Iniciar sesión</Text>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" style={styles.arrowIcon} />
                </>
              )}
            </TouchableOpacity>

            {/* Enlace Registro */}
            <TouchableOpacity
              style={styles.signUpContainer}
              onPress={() => navigation.navigate('SignUp')}
            >
              <Text style={styles.signUpText}>
                ¿No tienes cuenta aún?{' '}
                <Text style={styles.signUpBoldText}>Regístrate aquí</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pie de página institucional */}
          <Text style={styles.footerText}>
            Sistema de Gestión • Almacén El Refugio
          </Text>
        </View>
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
  },
  headerContainer: {
    backgroundColor: '#F2F6F4',
    paddingTop: Platform.OS === 'android' ? 48 : 60,
    paddingBottom: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logo: {
    width: '74%',
    height: 110,
    resizeMode: 'contain',
  },
  bodyContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#223344',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  bannerIcon: {
    marginRight: 10,
  },
  errorBannerText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  label: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#223344',
    marginBottom: 8,
    marginTop: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    height: 52,
  },
  inputBoxFocused: {
    borderWidth: 1.5,
    borderColor: '#EE684D',
    backgroundColor: '#FFFFFF',
  },
  inputBoxError: {
    borderWidth: 1.5,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#223344',
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  inlineErrorText: {
    color: '#DC2626',
    fontSize: 12.5,
    marginLeft: 5,
    fontWeight: '500',
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: 24,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: '#223344',
    fontSize: 13,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#EE684D',
    borderRadius: 12,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EE684D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.75,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  signUpContainer: {
    alignItems: 'center',
    marginTop: 28,
    paddingVertical: 6,
  },
  signUpText: {
    color: '#64748B',
    fontSize: 14,
  },
  signUpBoldText: {
    color: '#EE684D',
    fontWeight: 'bold',
  },
  footerText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 32,
  },
});