import React, { useState } from 'react';
import { 
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
} from 'react-native';
import { confirmPasswordReset } from 'firebase/auth'; 
import { auth } from '../src/config/firebaseConfig';

export default function NewPassword({ navigation, route }) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); 
    const [showPassword, setShowPassword] = useState(false);
    const { oobCode } = route.params || {}; 

    const handleNewPassword = async () => {
        if (!password.trim() || !confirmPassword.trim()) {
            Alert.alert("Error", "Por favor ingrese ambos campos.");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden.');
            return;
        }

        // Expresión regular corregida para validar la contraseña
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        if (!passwordRegex.test(password)) {
            Alert.alert(
                'Error',
                'La contraseña debe tener al menos 6 caracteres, incluyendo una letra mayúscula, una minúscula y un número.'
            );
            return;
        }
        
        try {
            await confirmPasswordReset(auth, oobCode, password);

            Alert.alert('Éxito', 'Contraseña actualizada correctamente.');
            navigation.navigate('Login');
        } catch (error) {
            console.error('Error al guardar la contraseña:', error.code, error.message);
            let errorMessage = 'No se pudo actualizar la contraseña.';
            if (error.code === 'auth/expired-action-code') {
                errorMessage = 'El código ha expirado. Solicite uno nuevo.';
            } else if (error.code === 'auth/invalid-action-code') {
                errorMessage = 'El código no es válido.';
            }
            Alert.alert('Error', errorMessage);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Nueva Contraseña</Text>
            
            <TextInput
                style={styles.input}
                placeholder="Nueva contraseña"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
            />

            <TextInput
                style={styles.input}
                placeholder="Confirmar contraseña"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
            />

            <TouchableOpacity style={styles.button} onPress={handleNewPassword}>
                <Text style={styles.buttonText}>Actualizar Contraseña</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
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
        borderWidth: 1,
        borderColor: '#EE684D',
        padding: 12, 
        borderRadius: 8,
        marginBottom: 15,
    },
    button: {
        backgroundColor: '#EE684D',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});