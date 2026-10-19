import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { auth } from '../src/config/firebaseConfig';

export default function RecoveryCode({ navigation }) {
    const [code, setCode] = useState('');

    const handleCode = async () => {
        if (!code.trim()) {
            Alert.alert("Error", "Ingrese el código.");
            return;
        }

        // Expresión regular corregida para los 5 caracteres
        const recoveryCodeRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z0-9]{5}$/;
        
        if (!recoveryCodeRegex.test(code)) {
            Alert.alert(
                'Error',
                'El código debe tener exactamente 5 caracteres (incluyendo una mayúscula, una minúscula y un número).'
            );
            return;
        }

        try {
            // Pasamos el código como parámetro ('oobCode') a la pantalla NewPassword
            navigation.navigate('NewPassword', { oobCode: code.trim() });
        } catch (error) {
            Alert.alert('Error', error.message);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Ingrese Código de Recuperación</Text>
            
            <TextInput
                style={styles.input}
                placeholder="Código de 5 caracteres"
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
            />

            <TouchableOpacity style={styles.button} onPress={handleCode}>
                <Text style={styles.buttonText}>Verificar Código</Text>
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
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});