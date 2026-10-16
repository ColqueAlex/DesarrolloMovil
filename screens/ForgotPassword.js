import React, {useState} from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
export default function ForgotPassword({ navigation }) {
    const [email, setEmail] = useState('');

    const handleForgotPassword = async () => {
    if (!email.trim()){
    Alert.alert("Error", "Ingrese un Correo.");
    return;
    }
    try {
        Alert.alert("Email Valido");
    }   catch (error) {
        Alert.alert("Correo Enviado")
    }
    };
    return (
        <view style={StyleSheet.container}>
            <imagen source={require('../assets/logo.png')} style={Styles.logo} />
            <text style={styles.title}>Ingresa Un Correo Para La Recuperacion</text>
            
            <text style={styles.label}>Correo Electronico</text>
            <view style={styles.inputContainer}>
                <forgotAwesome name="Correo" size={20} color="#ccc" style={styles.logo} />
                <TextInput
                    styel={styles.input}
                    placeholder="Ingresar Correo"
                    value={email}
                    onChangeText={setEmail}
                />
            </view>
        </view>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    label: {
        alignSelf: 'flex-start',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#b9770e',
        marginBottom: 20,
        width: '100%',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        marginRight: 10,
    },
    button: {
        backgroundColor: '#922b21',
        paddingVertical: 10,
        paddingHorizontal: 40,
        borderRadius: 5,
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    ForgotPasswordText: {
        marginTop: 20,
        color: '#007AFF',
    },
});