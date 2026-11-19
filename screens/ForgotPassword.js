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
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

export default function ForgotPassword({ navigation }) {
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleForgotPassword = async () => {
    setEmailError('');
    setGeneralError('');
    setSuccessMessage('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      setEmailError('Por favor, ingresa tu correo electrónico.');
      return;
    }

    if (!emailRegex.test(email.trim())) {
      setEmailError('El formato del correo no es válido (ej. usuario@correo.com).');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage(
        'Te enviamos un enlace a tu correo electrónico para restablecer tu contraseña. Revisa también la carpeta de spam.'
      );
    } catch (error) {
      console.log('Aviso de recuperación:', error.code);

      switch (error.code) {
        case 'auth/user-not-found':
          setEmailError('No encontramos ninguna cuenta asociada a este correo.');
          break;
        case 'auth/invalid-email':
          setEmailError('El formato del correo electrónico no es válido.');
          break;
        case 'auth/too-many-requests':
          setGeneralError(
            'Has realizado demasiados intentos. Espera unos minutos antes de volver a solicitar el enlace.'
          );
          break;
        case 'auth/network-request-failed':
          setGeneralError(
            'Sin conexión a internet. Verifica tu red e intenta nuevamente.'
          );
          break;
        default:
          setGeneralError(
            'No se pudo enviar el correo de recuperación en este momento. Intenta más tarde.'
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
          <View>
            <Text style={styles.mainTitle}>Recuperar contraseña</Text>
            <Text style={styles.subtitle}>
              Ingresa el correo registrado y te enviaremos un enlace para crear una nueva clave
            </Text>

            {/* Banner de éxito */}
            {successMessage ? (
              <View style={styles.successBanner}>
                <Feather
                  name="check-circle"
                  size={18}
                  color="#059669"
                  style={styles.bannerIcon}
                />
                <Text style={styles.successBannerText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Banner de error general */}
            {generalError ? (
              <View style={styles.errorBanner}>
                <Feather
                  name="alert-circle"
                  size={18}
                  color="#DC2626"
                  style={styles.bannerIcon}
                />
                <Text style={styles.errorBannerText}>{generalError}</Text>
              </View>
            ) : null}

            {/* Campo Correo electrónico */}
            <Text style={styles.label}>Correo electrónico</Text>
            <View
              style={[
                styles.inputBox,
                focused && styles.inputBoxFocused,
                emailError && styles.inputBoxError,
              ]}
            >
              <Feather
                name="mail"
                size={18}
                color={
                  emailError
                    ? '#DC2626'
                    : focused
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
                  if (emailError) setEmailError('');
                  if (generalError) setGeneralError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
            </View>
            {emailError ? (
              <View style={styles.inlineErrorRow}>
                <Feather name="info" size={13} color="#DC2626" />
                <Text style={styles.inlineErrorText}>{emailError}</Text>
              </View>
            ) : null}

            {/* Botón Enviar enlace */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Enviar enlace</Text>
                  <Feather name="send" size={16} color="#FFFFFF" style={styles.arrowIcon} />
                </>
              )}
            </TouchableOpacity>

            {/* Enlace volver a Iniciar Sesión */}
            <TouchableOpacity
              style={styles.bottomLinkContainer}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.bottomLinkText}>
                ¿Recordaste tu contraseña?{' '}
                <Text style={styles.bottomLinkBold}>Volver al inicio</Text>
              </Text>
            </TouchableOpacity>
          </View>

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
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 48 : 60,
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
    fontSize: 26,
    fontWeight: '800',
    color: '#223344',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  successBannerText: {
    flex: 1,
    color: '#065F46',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
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
    marginTop: 28,
    paddingVertical: 6,
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
    marginTop: 32,
  },
});