import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

const { width } = Dimensions.get('window');

export default function Home({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);

  const openInventory = () => {
    setMenuVisible(false);
    navigation.navigate('Inventory');
  };

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
      title: 'Registrar Compra',
      subtitle: 'Ingresos y proveedores',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'truck-delivery-outline',
      bgColor: '#FDE8E8',
      iconColor: '#E57373',
    },
    {
      id: '2',
      title: 'Productos del almacén',
      subtitle: 'Stock y catálogo',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'cube-outline',
      bgColor: '#E0F2F1',
      iconColor: '#26A69A',
    },
    {
      id: '3',
      title: 'Registrar descuento',
      subtitle: 'Rebajas temporales',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'percent-outline',
      bgColor: '#E0F2F1',
      iconColor: '#26A69A',
    },
    {
      id: '4',
      title: 'Registrar Promociones',
      subtitle: 'Campañas y combos',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'bullhorn-outline',
      bgColor: '#FDE8E8',
      iconColor: '#E57373',
    },
    {
      id: '5',
      title: 'Cuentas de clientes',
      subtitle: 'Saldos, pagos y movimientos',
      iconFamily: 'Ionicons',
      iconName: 'people-outline',
      bgColor: '#FDE8E8',
      iconColor: '#E57373',
    },
    {
      id: '6',
      title: 'Apertura y cierre de caja',
      subtitle: 'Abrir y cerrar la caja, registrar las ventas y finalizar la jornada',
      iconFamily: 'MaterialCommunityIcons',
      iconName: 'cash-register',
      bgColor: '#E0F2F1',
      iconColor: '#26A69A',
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
      return <MaterialCommunityIcons name={name} size={24} color={color} />;
    }
    if (family === 'Ionicons') {
      return <Ionicons name={name} size={24} color={color} />;
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú"
          >
            <Ionicons name="menu-outline" size={36} color="#1E293B" />
          </TouchableOpacity>

          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Almacén El Refugio"
          />
        </View>

        <TouchableOpacity style={styles.mainCard} activeOpacity={0.8}>
          <View style={styles.mainCardLeft}>
            <View style={styles.mainIconContainer}>
              <MaterialCommunityIcons name="package-variant-closed-check" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.mainCardText}>
              <Text style={styles.mainCardTitle}>Procesar Venta</Text>
              <Text style={styles.mainCardSubtitle}>Cobrar y registrar salida de stock</Text>
            </View>
          </View>
          <View style={styles.arrowCircle}>
            <Ionicons name="arrow-forward" size={20} color="#E55B4C" />
          </View>
        </TouchableOpacity>

        <View style={styles.gridContainer}>
          {menuOptions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.gridCard}
              activeOpacity={0.7}
              onPress={item.id === '2' ? openInventory : undefined}
              accessibilityRole={item.id === '2' ? 'button' : undefined}
              accessibilityLabel={item.id === '2' ? 'Abrir productos del almacén' : undefined}
            >
              <View style={styles.gridHeader}>
                <View style={[styles.gridIconContainer, { backgroundColor: item.bgColor }]}>
                  {renderIcon(item.iconFamily, item.iconName, item.iconColor)}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </View>
              <Text style={styles.gridTitle}>{item.title}</Text>
              <Text style={styles.gridSubtitle}>{item.subtitle}</Text>
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
              <View style={styles.profileAvatar} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Usuario</Text>
                <Text style={styles.profileRole}>Administradora</Text>
              </View>
              <TouchableOpacity style={styles.editButton}>
                <Feather name="edit-2" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerItemsContainer} showsVerticalScrollIndicator={false}>
              {drawerItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.drawerButton}
                  activeOpacity={0.7}
                  onPress={item.title === 'Producto' ? openInventory : undefined}
                  accessibilityRole={item.title === 'Producto' ? 'button' : undefined}
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
    paddingTop: 15,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  logo: {
    width: 170,
    height: 68,
  },
  mainCard: {
    backgroundColor: '#EE6C52',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  mainCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mainIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    padding: 10,
    borderRadius: 14,
    marginRight: 12,
  },
  mainCardText: {
    flex: 1,
  },
  mainCardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  mainCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    backgroundColor: '#FFFFFF',
    width: '48%',
    borderRadius: 16,
    padding: 14,
    marginBottom: 15,
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  gridIconContainer: {
    padding: 8,
    borderRadius: 12,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  gridSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 13,
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
  profileRole: {
    color: '#94A3B8',
    fontSize: 11,
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
