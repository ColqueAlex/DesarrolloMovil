import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../src/config/firebaseConfig';
import Login from '../screens/Login';
import SignUp from '../screens/SignUp';
import ForgotPassword from '../screens/ForgotPassword';
import RecoveryCode from '../screens/RecoveryCode';
import NewPassword from '../screens/NewPassword';
import Home from '../screens/Home';
import GestionInventario from '../screens/GestionInventario';
import AnimatedSplash from '../components/AnimatedSplash';

const Stack = createStackNavigator();

export default function Navigation() {
  const [user, setUser] = useState(undefined);
  const [splashReady, setSplashReady] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSplashReady(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Falta configurar Firebase. Copia .env.example como .env y completa los datos de tu proyecto.
        </Text>
      </View>
    );
  }

  if (user === undefined || !splashReady) {
    return <AnimatedSplash />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user && user.emailVerified ? (
          <>
            <Stack.Screen
              name="Home"
              component={Home}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Inventory"
              component={GestionInventario}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen 
              name="Login" 
              component={Login} 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="SignUp" 
              component={SignUp} 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="ForgotPassword" 
              component={ForgotPassword} 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="RecoveryCode" 
              component={RecoveryCode} 
              options={{ title: 'Ingresar Código' }} 
            />
            <Stack.Screen 
              name="NewPassword" 
              component={NewPassword} 
              options={{ title: 'Nueva Contraseña' }} 
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24 
  },
  message: { 
    textAlign: 'center', 
    fontSize: 16 
  },
});