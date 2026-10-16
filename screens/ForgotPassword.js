import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { FontAwesome, Feather } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

export default function ForgotPassword({ navigation }) {
  const [email, setEmail] = useState('');

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingrese su correo electrónico.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        'Correo enviado',
        'Se ha enviado un enlace a su correo para reestablecer la contraseña.'
      );
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error al enviar correo de recuperación:', error);
      let errorMessage = 'No se pudo enviar el correo de recuperación.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No existe una cuenta registrada con este correo.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El formato del correo electrónico no es válido.';
      }
      Alert.alert('Error', errorMessage);
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

        <Text style={styles.mainTitle}>Recuperar Contraseña</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <View style={styles.inputBox}>
            <Feather name="mail" size={18} color="#EE684D" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ingrese su correo"
              placeholderTextColor="#A0A5AA"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleForgotPassword}>
            <Text style={styles.buttonText}>Enviar enlace</Text>
            <FontAwesome name="paper-plane" size={15} color="#FFF" style={styles.iconButton} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToLoginContainer}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.backToLoginText}>Volver al Iniciar Sesión</Text>
          </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  logo: {
    width: '75%',
    height: 100,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 32,
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
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#212529',
  },
  button: {
    backgroundColor: '#EE684D',
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconButton: {
    marginLeft: 8,
  },
  backToLoginContainer: {
    alignItems: 'center',
    marginTop: 18,
  },
  backToLoginText: {
    color: '#495057',
    fontSize: 14,
    fontWeight: '600',
  },
});