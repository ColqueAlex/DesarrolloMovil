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
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

export default function SignUp({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({
    firstName: '',
    lastName: '',
    dni: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [generalError, setGeneralError] = useState('');

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
    if (generalError) setGeneralError('');
  };

  const validateFields = () => {
    let valid = true;
    const errors = {
      firstName: '',
      lastName: '',
      dni: '',
      email: '',
      password: '',
      confirmPassword: '',
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const dniRegex = /^\d{7,8}$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

    if (!firstName.trim()) {
      errors.firstName = 'Ingresa tu nombre.';
      valid = false;
    } else if (firstName.trim().length < 2) {
      errors.firstName = 'El nombre debe tener al menos 2 caracteres.';
      valid = false;
    }

    if (!lastName.trim()) {
      errors.lastName = 'Ingresa tu apellido.';
      valid = false;
    } else if (lastName.trim().length < 2) {
      errors.lastName = 'El apellido debe tener al menos 2 caracteres.';
      valid = false;
    }

    if (!dni.trim()) {
      errors.dni = 'Ingresa tu número de DNI.';
      valid = false;
    } else if (!dniRegex.test(dni.trim())) {
      errors.dni = 'El DNI debe contener entre 7 y 8 dígitos numéricos (sin puntos).';
      valid = false;
    }

    if (!email.trim()) {
      errors.email = 'Ingresa tu correo electrónico.';
      valid = false;
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'El formato del correo no es válido (ej. usuario@correo.com).';
      valid = false;
    }

    if (!password) {
      errors.password = 'Crea una contraseña.';
      valid = false;
    } else if (!passwordRegex.test(password)) {
      errors.password =
        'Debe tener al menos 6 caracteres, una mayúscula, una minúscula y un número.';
      valid = false;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirma tu contraseña.';
      valid = false;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden.';
      valid = false;
    }

    setFieldErrors(errors);
    return valid;
  };

  const handleSignUp = async () => {
    setGeneralError('');

    if (!validateFields()) {
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateProfile(credential.user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
      });
    } catch (error) {
      console.log('Aviso de registro:', error.code);

      switch (error.code) {
        case 'auth/email-already-in-use':
          setFieldErrors((prev) => ({
            ...prev,
            email: 'Este correo electrónico ya está registrado.',
          }));
          break;
        case 'auth/invalid-email':
          setFieldErrors((prev) => ({
            ...prev,
            email: 'El formato del correo electrónico no es válido.',
          }));
          break;
        case 'auth/weak-password':
          setFieldErrors((prev) => ({
            ...prev,
            password: 'La contraseña es demasiado débil.',
          }));
          break;
        case 'auth/network-request-failed':
          setGeneralError(
            'Sin conexión a internet. Verifica tu red e intenta nuevamente.'
          );
          break;
        default:
          setGeneralError(
            'No se pudo completar el registro en este momento. Intenta nuevamente.'
          );
          break;
      }
    } finally {
      setLoading(false);
    }
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
        {/* Cabecera curva superior con botón volver y logo */}
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Feather name="arrow-left" size={22} color="#223344" />
          </TouchableOpacity>
          <Image source={require('../assets/logo.png')} style={styles.logo} />
        </View>

        {/* Cuerpo principal */}
        <View style={styles.bodyContainer}>
          <Text style={styles.mainTitle}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Completa tus datos para registrarte</Text>

          {/* Banner de error general */}
          {generalError ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={18} color="#DC2626" style={styles.bannerIcon} />
              <Text style={styles.errorBannerText}>{generalError}</Text>
            </View>
          ) : null}

          {/* Nombre */}
          <Text style={styles.label}>Nombre</Text>
          <View
            style={[
              styles.inputBox,
              focusedField === 'firstName' && styles.inputBoxFocused,
              fieldErrors.firstName && styles.inputBoxError,
            ]}
          >
            <Feather
              name="user"
              size={18}
              color={
                fieldErrors.firstName
                  ? '#DC2626'
                  : focusedField === 'firstName'
                  ? '#EE684D'
                  : '#94A3B8'
              }
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej. Juan"
              placeholderTextColor="#64748B"
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                clearFieldError('firstName');
              }}
              onFocus={() => setFocusedField('firstName')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {fieldErrors.firstName ? (
            <View style={styles.inlineErrorRow}>
              <Feather name="info" size={13} color="#DC2626" />
              <Text style={styles.inlineErrorText}>{fieldErrors.firstName}</Text>
            </View>
          ) : null}

          {/* Apellido */}
          <Text style={styles.label}>Apellido</Text>
          <View
            style={[
              styles.inputBox,
              focusedField === 'lastName' && styles.inputBoxFocused,
              fieldErrors.lastName && styles.inputBoxError,
            ]}
          >
            <Feather
              name="user"
              size={18}
              color={
                fieldErrors.lastName
                  ? '#DC2626'
                  : focusedField === 'lastName'
                  ? '#EE684D'
                  : '#94A3B8'
              }
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej. Pérez"
              placeholderTextColor="#64748B"
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                clearFieldError('lastName');
              }}
              onFocus={() => setFocusedField('lastName')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {fieldErrors.lastName ? (
            <View style={styles.inlineErrorRow}>
              <Feather name="info" size={13} color="#DC2626" />
              <Text style={styles.inlineErrorText}>{fieldErrors.lastName}</Text>
            </View>
          ) : null}

          {/* DNI */}
          <Text style={styles.label}>DNI</Text>
          <View
            style={[
              styles.inputBox,
              focusedField === 'dni' && styles.inputBoxFocused,
              fieldErrors.dni && styles.inputBoxError,
            ]}
          >
            <Feather
              name="credit-card"
              size={18}
              color={
                fieldErrors.dni
                  ? '#DC2626'
                  : focusedField === 'dni'
                  ? '#EE684D'
                  : '#94A3B8'
              }
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej. 38456123"
              placeholderTextColor="#64748B"
              value={dni}
              onChangeText={(text) => {
                setDni(text.replace(/[^0-9]/g, ''));
                clearFieldError('dni');
              }}
              keyboardType="numeric"
              maxLength={8}
              onFocus={() => setFocusedField('dni')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {fieldErrors.dni ? (
            <View style={styles.inlineErrorRow}>
              <Feather name="info" size={13} color="#DC2626" />
              <Text style={styles.inlineErrorText}>{fieldErrors.dni}</Text>
            </View>
          ) : null}

          {/* Correo electrónico */}
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
              onChangeText={(text) => {
                setEmail(text);
                clearFieldError('email');
              }}
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

          {/* Contraseña */}
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
              placeholder="Mín. 6 caracteres, 1 mayúscula y 1 número"
              placeholderTextColor="#64748B"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearFieldError('password');
              }}
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

          {/* Confirmar Contraseña */}
          <Text style={styles.label}>Confirmar contraseña</Text>
          <View
            style={[
              styles.inputBox,
              focusedField === 'confirmPassword' && styles.inputBoxFocused,
              fieldErrors.confirmPassword && styles.inputBoxError,
            ]}
          >
            <Feather
              name="lock"
              size={18}
              color={
                fieldErrors.confirmPassword
                  ? '#DC2626'
                  : focusedField === 'confirmPassword'
                  ? '#EE684D'
                  : '#94A3B8'
              }
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Repite tu contraseña"
              placeholderTextColor="#64748B"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                clearFieldError('confirmPassword');
              }}
              secureTextEntry={!showConfirmPassword}
              onFocus={() => setFocusedField('confirmPassword')}
              onBlur={() => setFocusedField(null)}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Feather
                name={showConfirmPassword ? 'eye-off' : 'eye'}
                size={18}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>
          {fieldErrors.confirmPassword ? (
            <View style={styles.inlineErrorRow}>
              <Feather name="info" size={13} color="#DC2626" />
              <Text style={styles.inlineErrorText}>{fieldErrors.confirmPassword}</Text>
            </View>
          ) : null}

          {/* Botón Registrarse */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Registrarse</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" style={styles.arrowIcon} />
              </>
            )}
          </TouchableOpacity>

          {/* Volver a Login */}
          <TouchableOpacity
            style={styles.bottomLinkContainer}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.bottomLinkText}>
              ¿Ya tienes cuenta?{' '}
              <Text style={styles.bottomLinkBold}>Inicia sesión</Text>
            </Text>
          </TouchableOpacity>

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
    paddingBottom: 36,
  },
  headerContainer: {
    backgroundColor: '#F2F6F4',
    paddingTop: Platform.OS === 'android' ? 44 : 56,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 44 : 56,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  logo: {
    width: '68%',
    height: 85,
    resizeMode: 'contain',
  },
  bodyContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#223344',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
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
    marginBottom: 14,
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
    marginBottom: 6,
    marginTop: 10,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    height: 50,
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
    fontSize: 14.5,
    color: '#223344',
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    paddingHorizontal: 2,
  },
  inlineErrorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 12.5,
    marginLeft: 5,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#EE684D',
    borderRadius: 12,
    height: 54,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    shadowColor: '#EE684D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  bottomLinkContainer: {
    alignItems: 'center',
    marginTop: 22,
    paddingVertical: 8,
  },
  bottomLinkText: {
    color: '#64748B',
    fontSize: 14,
  },
  bottomLinkBold: {
    color: '#EE684D',
    fontWeight: 'bold',
  },
  footerText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 24,
  },
});