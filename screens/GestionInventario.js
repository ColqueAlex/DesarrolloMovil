import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';

const filtros = ['TODAS', 'Nombre', 'Lote'];
const { width } = Dimensions.get('window');
const contieneLetras = (valor) => /\p{L}/u.test(valor);
const categoriaValida = (valor) => /^[\p{L}\p{M}\s]+$/u.test(valor);

const drawerItems = [
  { id: '1', title: 'Producto', icon: 'cube-outline' },
  { id: '2', title: 'Proveedores', icon: 'truck-outline' },
  { id: '3', title: 'Compras', icon: 'cart-outline' },
  { id: '4', title: 'Ventas', icon: 'script-text-outline' },
  { id: '5', title: 'Usuarios', icon: 'account-outline' },
  { id: '6', title: 'Caja', icon: 'cash-register' },
];

const obtenerFechaLocal = () => {
  const hoy = new Date();
  return [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0'),
  ].join('-');
};

const fechaYaVencida = (fecha) => Boolean(fecha && fecha <= obtenerFechaLocal());

export default function GestionInventario({ navigation, route }) {
  const [productos, setProductos] = useState(route?.params?.productos ?? []);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSeleccionado, setFiltroSeleccionado] = useState('TODAS');
  const [menuVisible, setMenuVisible] = useState(false);
  const [filtrosVisibles, setFiltrosVisibles] = useState(false);
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS');
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [productoPorEliminar, setProductoPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorInventario, setErrorInventario] = useState('');
  const [formulario, setFormulario] = useState({
    nombre: '',
    lote: '',
    stock: '',
    precio: '',
    estado: 'ACTIVO',
    fechaVencimiento: '',
    categoria: '',
    marca: '',
  });
  const fechaVencimientoBloqueada = Boolean(
    productoEditando && fechaYaVencida(productoEditando.fechaVencimiento),
  );

  useEffect(() => {
    if (!db) {
      setErrorInventario('No se pudo conectar con la base de datos de inventario.');
      return undefined;
    }

    return onSnapshot(
      collection(db, 'productos'),
      (snapshot) => {
        setProductos(snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })));
        setErrorInventario('');
      },
      (error) => {
        console.error('Error al cargar productos:', error);
        setErrorInventario('No se pudieron cargar los productos. Verifica la conexión y las reglas de Firestore.');
      },
    );
  }, []);

  const actualizarCampo = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  };

  const cerrarFormulario = () => {
    if (guardando) return;
    setFormularioVisible(false);
    setProductoEditando(null);
  };

  const abrirFormularioNuevo = () => {
    setProductoEditando(null);
    setFormulario({
      nombre: '',
      lote: '',
      stock: '',
      precio: '',
      estado: 'ACTIVO',
      fechaVencimiento: '',
      categoria: '',
      marca: '',
    });
    setFormularioVisible(true);
  };

  const abrirFormularioEdicion = (producto) => {
    setProductoEditando(producto);
    setFormulario({
      nombre: producto.nombre ?? '',
      lote: producto.lote ?? '',
      stock: String(producto.stock ?? ''),
      precio: String(producto.precio ?? ''),
      estado: producto.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
      fechaVencimiento: producto.fechaVencimiento ?? '',
      categoria: producto.categoria ?? '',
      marca: producto.marca ?? '',
    });
    setFormularioVisible(true);
  };

  const eliminarProducto = async () => {
    if (!db || !productoPorEliminar?.id) {
      Alert.alert('Error', 'No se pudo identificar el producto para eliminarlo.');
      return;
    }

    setEliminando(true);
    try {
      await deleteDoc(doc(db, 'productos', productoPorEliminar.id));
      setProductoPorEliminar(null);
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      Alert.alert(
        'No se pudo eliminar',
        'Verifica tu conexión y que las reglas de Firestore permitan eliminar productos.',
      );
    } finally {
      setEliminando(false);
    }
  };

  const registrarProducto = async () => {
    const nombre = formulario.nombre.trim();
    const lote = formulario.lote.trim();
    const stock = Number(formulario.stock);
    const precio = Number(formulario.precio);
    const fechaVencimiento = fechaVencimientoBloqueada
      ? productoEditando.fechaVencimiento
      : formulario.fechaVencimiento.trim();

    if (
      !nombre
      || (!productoEditando && !lote)
      || formulario.stock.trim() === ''
      || formulario.precio.trim() === ''
    ) {
      Alert.alert(
        'Datos incompletos',
        productoEditando
          ? 'Ingresa el nombre, el stock y el precio del producto.'
          : 'Ingresa el nombre, el lote, el stock y el precio del producto.',
      );
      return;
    }

    if (!contieneLetras(nombre)) {
      Alert.alert('Nombre inválido', 'El nombre debe incluir al menos una letra; no puede contener solo números.');
      return;
    }

    if (!productoEditando && !/^\d+$/.test(lote)) {
      Alert.alert('Lote inválido', 'El lote debe contener solo números.');
      return;
    }

    const categoria = formulario.categoria.trim();
    if (categoria && !categoriaValida(categoria)) {
      Alert.alert('Categoría inválida', 'La categoría solo puede contener letras y espacios.');
      return;
    }

    const marca = formulario.marca.trim();
    if (marca && !contieneLetras(marca)) {
      Alert.alert('Marca inválida', 'La marca debe incluir al menos una letra; no puede contener solo números.');
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      Alert.alert('Stock inválido', 'El stock debe ser un número entero igual o mayor que cero.');
      return;
    }

    if (!Number.isFinite(precio) || precio < 0) {
      Alert.alert('Precio inválido', 'El precio debe ser un número igual o mayor que cero.');
      return;
    }

    if (fechaVencimiento && !fechaVencimientoBloqueada) {
      const partesFecha = fechaVencimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!partesFecha) {
        Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD para la fecha de vencimiento.');
        return;
      }

      const [, anio, mes, dia] = partesFecha;
      const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
      if (
        fecha.getUTCFullYear() !== Number(anio)
        || fecha.getUTCMonth() !== Number(mes) - 1
        || fecha.getUTCDate() !== Number(dia)
      ) {
        Alert.alert('Fecha inválida', 'Ingresa una fecha de vencimiento válida.');
        return;
      }

      if (fechaVencimiento <= obtenerFechaLocal()) {
        Alert.alert(
          'Fecha de vencimiento inválida',
          'La fecha de vencimiento debe ser posterior al día de hoy.',
        );
        return;
      }
    }

    if (!db) {
      Alert.alert('Error', 'No se pudo conectar con la base de datos de inventario.');
      return;
    }

    setGuardando(true);
    try {
      const datosProducto = {
        nombre,
        stock,
        precio,
        estado: formulario.estado,
        fechaVencimiento,
        categoria,
        marca,
      };

      if (productoEditando) {
        await updateDoc(doc(db, 'productos', productoEditando.id), {
          ...datosProducto,
          actualizadoEn: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'productos'), {
          ...datosProducto,
          lote,
          creadoEn: serverTimestamp(),
        });
      }

      setFormulario({
        nombre: '',
        lote: '',
        stock: '',
        precio: '',
        estado: 'ACTIVO',
        fechaVencimiento: '',
        categoria: '',
        marca: '',
      });
      setFormularioVisible(false);
      setProductoEditando(null);
    } catch (error) {
      console.error(
        productoEditando ? 'Error al actualizar producto:' : 'Error al registrar producto:',
        error,
      );
      Alert.alert(
        productoEditando ? 'No se pudo actualizar' : 'No se pudo registrar',
        'Ocurrió un error al guardar el producto. Verifica la conexión y las reglas de Firestore e inténtalo de nuevo.',
      );
    } finally {
      setGuardando(false);
    }
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

  const productosFiltrados = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase();

    const resultado = productos.filter((producto) => {
      const nombre = String(producto.nombre ?? '').toLocaleLowerCase();
      const lote = String(producto.lote ?? '').toLocaleLowerCase();
      const estado = String(producto.estado ?? 'INACTIVO').toLocaleUpperCase();
      const categoria = String(producto.categoria ?? '').trim().toLocaleLowerCase();

      if (estadoFiltro !== 'TODOS' && estado !== estadoFiltro) return false;
      if (
        categoriaFiltro !== 'TODAS'
        && categoria !== categoriaFiltro.toLocaleLowerCase()
      ) return false;
      if (!consulta) return true;
      if (filtroSeleccionado === 'Nombre') return nombre.includes(consulta);
      if (filtroSeleccionado === 'Lote') return lote.includes(consulta);
      return nombre.includes(consulta) || lote.includes(consulta);
    });

    if (filtroSeleccionado === 'Lote') {
      return resultado.sort((productoA, productoB) => (
        String(productoA.lote ?? '').localeCompare(
          String(productoB.lote ?? ''),
          undefined,
          { numeric: true, sensitivity: 'base' },
        )
      ));
    }

    return resultado;
  }, [busqueda, categoriaFiltro, estadoFiltro, filtroSeleccionado, productos]);

  const categorias = useMemo(() => (
    [...new Set(
      productos
        .map((producto) => String(producto.categoria ?? '').trim())
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  ), [productos]);

  const hayFiltrosAplicados = estadoFiltro !== 'TODOS' || categoriaFiltro !== 'TODAS';

  const renderProductCard = ({ item }) => {
    const activo = item.estado === 'ACTIVO';
    const stock = Number(item.stock) || 0;
    const precio = Number(item.precio);

    return (
      <View style={styles.productRow}>
        <View style={styles.card}>
          <View
            style={[
              styles.cardIndicator,
              { backgroundColor: activo ? '#10B981' : '#EF4444' },
            ]}
          />
          <View style={styles.cardContent}>
            <View style={styles.rowTop}>
              <View style={styles.nombreContainer}>
                <Text style={styles.productName}>{item.nombre || 'Producto sin nombre'}</Text>
                <Text style={styles.loteText}>Lote: {item.lote || 'Sin lote'}</Text>
              </View>

              <View style={styles.stockContainer}>
                <Text style={styles.stockLabel}>
                  Stock{' '}
                  <Text style={[styles.stockNumber, stock <= 5 && styles.stockWarning]}>
                    {stock}
                  </Text>
                </Text>
              </View>

              <View style={styles.precioContainer}>
                <Text style={styles.precioText}>
                  {Number.isFinite(precio) ? `$${precio.toFixed(2)}` : '—'}
                </Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: activo ? '#D1FAE5' : '#FEE2E2' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: activo ? '#047857' : '#B91C1C' },
                    ]}
                  >
                    {item.estado || 'INACTIVO'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.rowBottom}>
              <View style={styles.expiryContainer}>
                <Text style={styles.metaLabel}>FECHA DE VENCIMIENTO</Text>
                <Text style={styles.metaValue}>{item.fechaVencimiento || 'N/A'}</Text>
              </View>
              <View style={styles.categoryContainer}>
                <Text style={styles.metaLabel}>
                  {item.categoria ? String(item.categoria).toUpperCase() : 'GENERAL'}
                </Text>
                <Text style={styles.metaValue}>{item.marca || 'Sin marca'}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.editProductButton}
            onPress={() => abrirFormularioEdicion(item)}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.nombre || 'producto'}`}
            hitSlop={8}
          >
            <Feather name="edit-2" size={17} color="#2563EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteProductButton}
            onPress={() => setProductoPorEliminar(item)}
            accessibilityRole="button"
            accessibilityLabel={`Eliminar ${item.nombre || 'producto'}`}
            hitSlop={8}
          >
            <Feather name="trash-2" size={17} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú"
            hitSlop={10}
          >
            <Ionicons name="menu-outline" size={36} color="#1E293B" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => {
            setMenuVisible(false);
            navigation.navigate('Home');
          }}
          accessibilityRole="button"
          accessibilityLabel="Volver al menú principal"
          hitSlop={10}
        >
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Almacén El Refugio"
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.screenTitle}>Gestión de Inventario</Text>

      <View style={styles.searchBox}>
        <Ionicons
          name="search-outline"
          size={18}
          color="#64748B"
          style={styles.searchIcon}
        />
        <TextInput
          placeholder={
            filtroSeleccionado === 'Lote'
              ? 'Buscar por lote'
              : filtroSeleccionado === 'Nombre'
                ? 'Buscar por nombre del producto'
                : 'Buscar por nombre o lote'
          }
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          value={busqueda}
          onChangeText={setBusqueda}
          accessibilityLabel="Buscar productos"
        />
      </View>

      <View style={styles.tabContainer}>
        {filtros.map((filtro) => (
          <TouchableOpacity
            key={filtro}
            style={[
              styles.tabButton,
              filtroSeleccionado === filtro && styles.tabActive,
            ]}
            onPress={() => setFiltroSeleccionado(filtro)}
            accessibilityRole="button"
            accessibilityState={{ selected: filtroSeleccionado === filtro }}
          >
            <Text
              style={[
                styles.tabText,
                filtroSeleccionado === filtro && styles.tabTextActive,
              ]}
            >
              {filtro}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.subTitle}>Productos registrados</Text>
        <View style={styles.subHeaderActions}>
          <TouchableOpacity
            style={[styles.filterButton, hayFiltrosAplicados && styles.filterButtonActive]}
            onPress={() => setFiltrosVisibles(true)}
            accessibilityRole="button"
            accessibilityLabel="Filtrar productos por estado o categoría"
          >
            <Ionicons
              name="funnel-outline"
              size={15}
              color={hayFiltrosAplicados ? '#FFFFFF' : '#2563EB'}
            />
            <Text style={[styles.filterButtonText, hayFiltrosAplicados && styles.filterButtonTextActive]}>
              Filtrar
            </Text>
          </TouchableOpacity>
          <Text style={styles.resultCount}>{productosFiltrados.length}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={abrirFormularioNuevo}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Registrar producto</Text>
      </TouchableOpacity>

      {errorInventario ? (
        <Text style={styles.errorMessage}>{errorInventario}</Text>
      ) : null}

      <FlatList
        data={productosFiltrados}
        keyExtractor={(item, index) =>
          item.id ? String(item.id) : `${item.nombre || 'producto'}-${index}`
        }
        renderItem={renderProductCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="package-variant-remove"
              size={48}
              color="#94A3B8"
            />
            <Text style={styles.emptyText}>
              {busqueda || hayFiltrosAplicados
                ? 'No se encontraron productos con esa búsqueda'
                : 'No hay productos registrados disponibles'}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.copyrightContainer}>
            <Text style={styles.copyrightText}>
              © 2026 InventoryMaster Pro. Todos los derechos reservados.
            </Text>
            <Text style={styles.legalLinks}>
              Términos de Servicio  |  Privacidad  |  Soporte Técnico
            </Text>
          </View>
        }
      />

      <Modal
        visible={filtrosVisibles}
        transparent
        animationType="fade"
        onRequestClose={() => setFiltrosVisibles(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setFiltrosVisibles(false)}>
            <View style={styles.confirmBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.filterModalCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Filtrar productos</Text>
              <TouchableOpacity
                onPress={() => setFiltrosVisibles(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar filtros"
              >
                <Ionicons name="close" size={26} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionTitle}>Estado</Text>
            <View style={styles.filterOptions}>
              {['TODOS', 'ACTIVO', 'INACTIVO'].map((estado) => (
                <TouchableOpacity
                  key={estado}
                  style={[
                    styles.filterOption,
                    estadoFiltro === estado && styles.filterOptionSelected,
                  ]}
                  onPress={() => setEstadoFiltro(estado)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: estadoFiltro === estado }}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      estadoFiltro === estado && styles.filterOptionTextSelected,
                    ]}
                  >
                    {estado === 'TODOS' ? 'Todos' : estado}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>Categoría</Text>
            <ScrollView
              style={styles.categoryFilterList}
              showsVerticalScrollIndicator={false}
            >
              {['TODAS', ...categorias].map((categoria) => (
                <TouchableOpacity
                  key={categoria}
                  style={styles.categoryFilterOption}
                  onPress={() => setCategoriaFiltro(categoria)}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: categoriaFiltro.toLocaleLowerCase() === categoria.toLocaleLowerCase(),
                  }}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      categoriaFiltro.toLocaleLowerCase() === categoria.toLocaleLowerCase()
                        && styles.filterOptionTextSelected,
                    ]}
                  >
                    {categoria === 'TODAS' ? 'Todas las categorías' : categoria}
                  </Text>
                  {categoriaFiltro.toLocaleLowerCase() === categoria.toLocaleLowerCase() ? (
                    <Ionicons name="checkmark" size={18} color="#0F766E" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.filterModalActions}>
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setEstadoFiltro('TODOS');
                  setCategoriaFiltro('TODAS');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.clearFiltersText}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyFiltersButton}
                onPress={() => setFiltrosVisibles(false)}
                accessibilityRole="button"
              >
                <Text style={styles.applyFiltersText}>Ver {productosFiltrados.length} productos</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(productoPorEliminar)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!eliminando) setProductoPorEliminar(null);
        }}
      >
        <View style={styles.confirmModalOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              if (!eliminando) setProductoPorEliminar(null);
            }}
          >
            <View style={styles.confirmBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Feather name="trash-2" size={22} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>¿Eliminar producto?</Text>
            <Text style={styles.confirmMessage}>
              Se eliminará {productoPorEliminar?.nombre || 'este producto'} del inventario.
              Esta acción no se puede deshacer.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelDeleteButton}
                onPress={() => setProductoPorEliminar(null)}
                disabled={eliminando}
                accessibilityRole="button"
              >
                <Text style={styles.cancelDeleteText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  eliminando && styles.saveButtonDisabled,
                ]}
                onPress={eliminarProducto}
                disabled={eliminando}
                accessibilityRole="button"
              >
                <Text style={styles.confirmDeleteText}>
                  {eliminando ? 'Eliminando...' : 'Eliminar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={formularioVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarFormulario}
      >
        <View style={styles.formModalOverlay}>
          <TouchableWithoutFeedback onPress={cerrarFormulario}>
            <View style={styles.formBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.formModalCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {productoEditando ? 'Editar producto' : 'Registrar producto'}
              </Text>
              <TouchableOpacity
                onPress={cerrarFormulario}
                accessibilityRole="button"
                accessibilityLabel="Cerrar formulario"
                disabled={guardando}
              >
                <Ionicons name="close" size={26} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
            >
              <Text style={styles.inputLabel}>Nombre *</Text>
              <TextInput
                style={styles.formInput}
                value={formulario.nombre}
                onChangeText={(valor) => actualizarCampo('nombre', valor)}
                placeholder="Nombre del producto"
                placeholderTextColor="#94A3B8"
                maxLength={100}
              />

              {!productoEditando ? (
                <>
                  <Text style={styles.inputLabel}>Lote *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formulario.lote}
                    onChangeText={(valor) => actualizarCampo('lote', valor)}
                    placeholder="Número o código de lote"
                    placeholderTextColor="#94A3B8"
                    maxLength={60}
                    autoCapitalize="characters"
                  />
                </>
              ) : null}

              <View style={styles.formRow}>
                <View style={styles.formColumn}>
                  <Text style={styles.inputLabel}>Stock *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formulario.stock}
                    onChangeText={(valor) => actualizarCampo('stock', valor)}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.formColumn}>
                  <Text style={styles.inputLabel}>Precio *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formulario.precio}
                    onChangeText={(valor) => actualizarCampo('precio', valor)}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Estado</Text>
              <View style={styles.statusOptions}>
                {['ACTIVO', 'INACTIVO'].map((estado) => (
                  <TouchableOpacity
                    key={estado}
                    style={[
                      styles.statusOption,
                      formulario.estado === estado && styles.statusOptionSelected,
                    ]}
                    onPress={() => actualizarCampo('estado', estado)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: formulario.estado === estado }}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        formulario.estado === estado && styles.statusOptionTextSelected,
                      ]}
                    >
                      {estado}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Fecha de vencimiento</Text>
              <TextInput
                style={[
                  styles.formInput,
                  fechaVencimientoBloqueada && styles.formInputDisabled,
                ]}
                value={formulario.fechaVencimiento}
                onChangeText={(valor) => actualizarCampo('fechaVencimiento', valor)}
                placeholder="AAAA-MM-DD (opcional)"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                editable={!fechaVencimientoBloqueada}
              />
              {fechaVencimientoBloqueada ? (
                <Text style={styles.disabledFieldHint}>
                  El producto ya venció; no se puede modificar su fecha de vencimiento.
                </Text>
              ) : null}

              <Text style={styles.inputLabel}>Categoría</Text>
              <TextInput
                style={styles.formInput}
                value={formulario.categoria}
                onChangeText={(valor) => actualizarCampo('categoria', valor)}
                placeholder="Categoría (opcional)"
                placeholderTextColor="#94A3B8"
                maxLength={60}
              />

              <Text style={styles.inputLabel}>Marca</Text>
              <TextInput
                style={styles.formInput}
                value={formulario.marca}
                onChangeText={(valor) => actualizarCampo('marca', valor)}
                placeholder="Marca (opcional)"
                placeholderTextColor="#94A3B8"
                maxLength={60}
              />

              <TouchableOpacity
                style={[styles.saveButton, guardando && styles.saveButtonDisabled]}
                onPress={registrarProducto}
                activeOpacity={0.8}
                disabled={guardando}
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonText}>
                  {guardando
                    ? productoEditando ? 'Guardando cambios...' : 'Guardando...'
                    : productoEditando ? 'Guardar cambios' : 'Guardar producto'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                  onPress={() => item.title === 'Producto' && setMenuVisible(false)}
                  accessibilityRole="button"
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
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 170,
    height: 68,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 15,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#EFF6FF',
    gap: 5,
  },
  filterButtonActive: {
    backgroundColor: '#2563EB',
  },
  filterButtonText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: 'bold',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  resultCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EE6C52',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 12,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  errorMessage: {
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardIndicator: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 10,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nombreContainer: {
    flex: 1.2,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  loteText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  stockContainer: {
    flex: 1,
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 11,
    color: '#475569',
  },
  stockNumber: {
    fontWeight: 'bold',
    color: '#0F172A',
  },
  stockWarning: {
    color: '#D97706',
  },
  precioContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  precioText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiryContainer: {
    flex: 1,
  },
  categoryContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  productActions: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    gap: 8,
  },
  editProductButton: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteProductButton: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: 'bold',
  },
  metaValue: {
    fontSize: 10,
    color: '#334155',
    marginTop: 1,
  },
  listContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  copyrightContainer: {
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  copyrightText: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
    textAlign: 'center',
  },
  legalLinks: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
  formModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  formBackdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  formModalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  filterModalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  filterSectionTitle: {
    color: '#334155',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  filterOption: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 10,
  },
  filterOptionSelected: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0F766E',
  },
  filterOptionText: {
    color: '#64748B',
    fontSize: 13,
  },
  filterOptionTextSelected: {
    color: '#0F766E',
    fontWeight: 'bold',
  },
  categoryFilterList: {
    maxHeight: 180,
  },
  categoryFilterOption: {
    minHeight: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 4,
  },
  filterModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  clearFiltersButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  clearFiltersText: {
    color: '#334155',
    fontWeight: 'bold',
  },
  applyFiltersButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1B3A57',
  },
  applyFiltersText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  formContent: {
    paddingBottom: 8,
  },
  inputLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  formInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#1E293B',
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  formInputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
  disabledFieldHint: {
    color: '#B45309',
    fontSize: 11,
    marginTop: 5,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formColumn: {
    flex: 1,
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  statusOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  statusOptionSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#CCFBF1',
  },
  statusOptionText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  statusOptionTextSelected: {
    color: '#0F766E',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#1B3A57',
    borderRadius: 8,
    paddingVertical: 13,
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmBackdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
  },
  confirmIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  confirmMessage: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 20,
  },
  cancelDeleteButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelDeleteText: {
    color: '#334155',
    fontWeight: 'bold',
  },
  confirmDeleteButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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
