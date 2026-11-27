import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';
import ProfileEditModal from './ProfileEditModal';
import ProfileRoleLabel from './ProfileRoleLabel';

const { width } = Dimensions.get('window');

// Paleta de la marca (colores del logo).
const BRAND = {
  coral: { icon: '#EE684D', bg: '#FDECE8' },
  green: { icon: '#3E9B78', bg: '#E4F3EC' },
  navy: { icon: '#254C7B', bg: '#E6EDF5' },
};

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const formatToday = () => {
  const today = new Date();
  return `${WEEKDAYS[today.getDay()]} ${today.getDate()} de ${MONTHS[today.getMonth()]}`;
};

export default function Home({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [profileEditorVisible, setProfileEditorVisible] = useState(false);
  const [profileName, setProfileName] = useState(auth?.currentUser?.displayName || 'Usuario');
  const [profileImageUri, setProfileImageUri] = useState(auth?.currentUser?.photoURL || '');

  useEffect(() => {
    const user = auth?.currentUser;
    // Carga la foto al entrar (para el encabezado) y cada vez que se abre el menú.
    if (!user || !db) return undefined;

    let cancelled = false;
    getDoc(doc(db, 'usuarios', user.uid))
      .then((profileSnapshot) => {
        if (cancelled) return;
        const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
        setProfileImageUri(profile.fotoPerfil || user.photoURL || '');
      })
      .catch((error) => {
        console.error('Error al cargar la foto del perfil:', error);
        if (!cancelled && menuVisible) {
          Alert.alert('No se pudo cargar la foto', 'Intenta abrir el menú nuevamente.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [menuVisible]);

  const openInventory = () => {
    setMenuVisible(false);
    navigation.navigate('Inventory');
  };

  const openPurchases = () => {
    setMenuVisible(false);
    navigation.navigate('Purchases');
  };

  const openCustomers = () => {
    setMenuVisible(false);
    navigation.navigate('Customers');
  };

  // Pantallas ya disponibles: id de la tarjeta -> acción.
  const cardActions = { '1': openPurchases, '2': openInventory, '5': openCustomers };
  const drawerActions = { Producto: openInventory, Compras: openPurchases };

  const handleLogOut = async () => {
    if (!auth) {
      Alert.alert('Error', 'No se pudo conectar con el servicio de autenticación.');
      return;
    }

    try {
      await signOut(auth);
      setMenuVisible(false);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión. Inténtalo de nuevo.');
    }
  };

  const menuOptions = [
    {
      id: '1',
      title: 'Registrar compra',
      subtitle: 'Ingresos y proveedores',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'truck-delivery-outline',
      color: BRAND.coral,
    },
    {
      id: '2',
      title: 'Productos del almacén',
      subtitle: 'Stock y catálogo',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'cube-outline',
      color: BRAND.green,
    },
    {
      id: '3',
      title: 'Registrar descuento',
      subtitle: 'Rebajas temporales',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'percent-outline',
      color: BRAND.green,
    },
    {
      id: '4',
      title: 'Registrar promociones',
      subtitle: 'Campañas y combos',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'bullhorn-outline',
      color: BRAND.navy,
    },
    {
      id: '5',
      title: 'Cuentas de clientes',
      subtitle: 'Saldos, pagos y movimientos',
      iconFamily: 'Ionicons',
      iconName: 'people-outline',
      color: BRAND.navy,
    },
    {
      id: '6',
      title: 'Apertura y cierre de caja',
      subtitle: 'Control de caja y cierre diario',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'cash-register',
      color: BRAND.coral,
    },
  ];

  const drawerItems = [
    { id: '1', title: 'Producto', icon: 'cube-outline', family: 'MaterialCommunityIcons' },
    { id: '2', title: 'Proveedores', icon: 'truck-outline', family: 'MaterialCommunityIcons' },
    { id: '3', title: 'Compras', icon: 'cart-outline', family: 'MaterialCommunityIcons' },
    { id: '4', title: 'Ventas', icon: 'script-text-outline', family: 'MaterialCommunityIcons' },
    { id: '5', title: 'Usuarios', icon: 'account-outline', family: 'MaterialCommunityIcons' },
    { id: '6', title: 'Caja', icon: 'cash-register', family: 'MaterialCommunityIcons' },
  ];

  const renderIcon = (family, name, color) => {
    if (family === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={name} size={26} color={color} />;
    }
    if (family === 'Ionicons') {
      return <Ionicons name={name} size={26} color={color} />;
    }
    return null;
  };

  const firstName = (profileName || 'Usuario').trim().split(/\s+/)[0];
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú"
          >
            <Ionicons name="menu-outline" size={26} color="#1E293B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerAvatar}
            onPress={() => setProfileEditorVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
          >
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.headerAvatarImage} />
            ) : (
              <Text style={styles.headerAvatarInitial}>{initial}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.greeting}>
          <Text style={styles.greetingTitle} numberOfLines={1}>
            Hola, {firstName} 👋
          </Text>
          <Text style={styles.greetingDate}>{formatToday()}</Text>
        </View>

        <TouchableOpacity
          style={styles.mainCard}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Procesar venta"
        >
          <View style={styles.mainIconContainer}>
            <MaterialCommunityIcons name="cart-arrow-right" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.mainCardText}>
            <Text style={styles.mainCardTitle}>Procesar venta</Text>
            <Text style={styles.mainCardSubtitle}>Cobrar y registrar salida de stock</Text>
          </View>
          <View style={styles.arrowCircle}>
            <Ionicons name="arrow-forward" size={20} color="#EE684D" />
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Accesos rápidos</Text>

        <View style={styles.gridContainer}>
          {menuOptions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.gridCard}
              activeOpacity={0.7}
              onPress={cardActions[item.id]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={[styles.gridIconContainer, { backgroundColor: item.color.bg }]}>
                {renderIcon(item.iconFamily, item.iconName, item.color.icon)}
              </View>
              <View>
                <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.gridSubtitle} numberOfLines={2}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.drawerContainer}>
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.profileAvatarImage} />
                ) : null}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>{profileName}</Text>
                <ProfileRoleLabel />
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setMenuVisible(false);
                  setProfileEditorVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Editar perfil"
              >
                <Feather name="edit-2" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerItemsContainer} showsVerticalScrollIndicator={false}>
              {drawerItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.drawerButton}
                  activeOpacity={0.7}
                  onPress={drawerActions[item.title]}
                  accessibilityRole={drawerActions[item.title] ? 'button' : undefined}
                >
                  <View style={styles.drawerIconBox}>
                    <MaterialCommunityIcons name={item.icon} size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.drawerButtonText}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.logoutButton}
              activeOpacity={0.8}
              onPress={handleLogOut}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
            >
              <View style={styles.logoutIconBox}>
                <Feather name="log-out" size={18} color="#E53935" />
              </View>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setMenuVisible(false)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú"
          >
            <Ionicons name="close" size={28} color="#1B3A57" />
          </TouchableOpacity>
        </View>
      </Modal>
      <ProfileEditModal
        visible={profileEditorVisible}
        initialName={profileName}
        onClose={() => setProfileEditorVisible(false)}
        onSaved={(name, imageUri) => {
          setProfileName(name);
          setProfileImageUri(imageUri || '');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F0',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEF1EF',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#254C7B',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  headerAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  greeting: {
    marginBottom: 22,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  greetingDate: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  mainCard: {
    backgroundColor: '#EE684D',
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    elevation: 6,
    shadowColor: '#EE684D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  mainIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  mainCardText: {
    flex: 1,
  },
  mainCardTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
  },
  mainCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    marginTop: 3,
  },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 14,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    backgroundColor: '#FFFFFF',
    width: '48%',
    minHeight: 150,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EEF1EF',
    elevation: 2,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  gridIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  gridSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  drawerContainer: {
    width: width * 0.6,
    backgroundColor: '#1B3A57',
    paddingTop: 45,
    paddingHorizontal: 16,
    paddingBottom: 25,
    justifyContent: 'space-between',
    height: '100%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 10,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 4,
  },
  drawerItemsContainer: {
    flex: 1,
  },
  drawerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  drawerIconBox: {
    marginRight: 12,
  },
  drawerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FADBD8',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  logoutIconBox: {
    marginRight: 10,
  },
  logoutText: {
    color: '#D9381E',
    fontSize: 15,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: 30,
    left: width * 0.6 + 15,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
