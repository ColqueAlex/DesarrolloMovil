import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';

export default function ProfileRoleLabel() {
  const [isAdministrator, setIsAdministrator] = useState(false);

  useEffect(() => {
    const user = auth?.currentUser;
    if (!user || !db) return undefined;

    let cancelled = false;
    getDoc(doc(db, 'usuarios', user.uid))
      .then((profileSnapshot) => {
        if (!cancelled) {
          setIsAdministrator(
            profileSnapshot.exists() && profileSnapshot.data().rol === 'administrador',
          );
        }
      })
      .catch((error) => {
        console.error('Error al consultar el rol del usuario:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAdministrator) return null;

  return <Text style={styles.role}>Administradora</Text>;
}

const styles = StyleSheet.create({
  role: {
    color: '#94A3B8',
    fontSize: 11,
  },
});
