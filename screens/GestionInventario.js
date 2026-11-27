import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';
import ProfileEditModal from './ProfileEditModal';
import ProfileRoleLabel from './ProfileRoleLabel';

/*
 * Catálogo de productos.
 *
 * productos/{productoId}
 *   nombre, categoria, marca (opcional), precio (precio de venta),
 *   estado ('ACTIVO' | 'INACTIVO'), creadoEn, actualizadoEn
 *
 * productos/{productoId}/lotes/{loteId}   ← se crean desde "Registrar compra"
 *   numero (string), cantidad (number), fechaVencimiento ('AAAA-MM-DD' o ''),
 *   creadoEn (timestamp)
 *
 * Los productos antiguos guardaban lote, stock y fechaVencimiento dentro del
 * propio producto: esos datos se muestran como un lote más ("Registro anterior").
 */

const { width } = Dimensions.get('window');

const COLORS = {
  background: '#FAF6F0',
  text: '#1E293B',
  muted: '#64748B',
  border: '#EEF1EF',
  coral: '#EE684D',
  coralSoft: '#FDECE8',
  green: '#3E9B78',
  greenSoft: '#E4F3EC',
  navy: '#254C7B',
  navySoft: '#E6EDF5',
  amber: '#B7791F',
  amberSoft: '#FDF3E1',
  red: '#C2410C',
  redSoft: '#FDE8E3',
};

const DIAS_POR_VENCER = 30;

const drawerItems = [
  { id: '1', title: 'Producto', icon: 'cube-outline' },
  { id: '2', title: 'Proveedores', icon: 'truck-outline' },
  { id: '3', title: 'Compras', icon: 'cart-outline' },
  { id: '4', title: 'Ventas', icon: 'script-text-outline' },
  { id: '5', title: 'Usuarios', icon: 'account-outline' },
  { id: '6', title: 'Caja', icon: 'cash-register' },
];

const FORMULARIO_VACIO = {
  nombre: '',
  categoria: '',
  marca: '',
  precio: '',
  estado: 'ACTIVO',
};

const contieneLetras = (valor) => /\p{L}/u.test(valor);
const categoriaValida = (valor) => /^[\p{L}\p{M}\s]+$/u.test(valor);
const normalizar = (valor) => String(valor ?? '').trim().toLocaleLowerCase();

const formatearPrecio = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? `$${numero.toFixed(2)}` : '—';
};

const fechaLocalHoy = () => {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
};

const parsearFecha = (texto) => {
  const partes = String(texto ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) return null;
  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
};

const formatearFecha = (valor) => {
  let fecha = null;
  if (typeof valor === 'string') fecha = parsearFecha(valor);
  else if (valor?.toDate) fecha = valor.toDate();
  if (!fecha) return null;
  return [
    String(fecha.getDate()).padStart(2, '0'),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    fecha.getFullYear(),
  ].join('/');
};

// Vencido si la fecha es hoy o anterior (mismo criterio que la versión previa).
const estadoDelLote = (lote) => {
  const fecha = parsearFecha(lote.fechaVencimiento);
  if (!fecha) return 'SIN_FECHA';
  const dias = Math.round((fecha - fechaLocalHoy()) / 86400000);
  if (dias <= 0) return 'VENCIDO';
  if (dias <= DIAS_POR_VENCER) return 'POR_VENCER';
  return 'VIGENTE';
};

const ESTILO_LOTE = {
  VENCIDO: { texto: 'Vencido', color: COLORS.red, fondo: COLORS.redSoft },
  POR_VENCER: { texto: 'Por vencer', color: COLORS.amber, fondo: COLORS.amberSoft },
  VIGENTE: { texto: 'Vigente', color: COLORS.green, fondo: COLORS.greenSoft },
  SIN_FECHA: { texto: 'Sin vencimiento', color: COLORS.muted, fondo: '#F1F5F9' },
};

const ordenarLotes = (lotes) => [...lotes].sort((a, b) => {
  const fechaA = a.fechaVencimiento || '9999-99-99';
  const fechaB = b.fechaVencimiento || '9999-99-99';
  return fechaA.localeCompare(fechaB);
});

const resumirLotes = (lotes) => {
  let stock = 0;
  let porVencer = 0;
  let vencidos = 0;
  lotes.forEach((lote) => {
    const estado = estadoDelLote(lote);
    if (estado === 'VENCIDO') {
      vencidos += 1;
      return;
    }
    if (estado === 'POR_VENCER') porVencer += 1;
    stock += Number(lote.cantidad) || 0;
  });
  return { stock, porVencer, vencidos, cantidad: lotes.length };
};

export default function GestionInventario({ navigation }) {
  const [productos, setProductos] = useState([]);
  const [lotesPorProducto, setLotesPorProducto] = useState({});
  const [cargando, setCargando] = useState(true);
  const [errorInventario, setErrorInventario] = useState('');
  const [errorLotes, setErrorLotes] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS');
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');

  const [productoDetalleId, setProductoDetalleId] = useState(null);
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [erroresFormulario, setErroresFormulario] = useState({});
  const [guardando, setGuardando] = useState(false);

  const [menuVisible, setMenuVisible] = useState(false);
  const [profileEditorVisible, setProfileEditorVisible] = useState(false);
  const [profileName, setProfileName] = useState(auth?.currentUser?.displayName || 'Usuario');
  const [profileImageUri, setProfileImageUri] = useState(auth?.currentUser?.photoURL || '');

  useEffect(() => {
    const user = auth?.currentUser;
    if (!menuVisible || !user || !db) return undefined;

    let cancelled = false;
    getDoc(doc(db, 'usuarios', user.uid))
      .then((profileSnapshot) => {
        if (cancelled) return;
        const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
        setProfileImageUri(profile.fotoPerfil || user.photoURL || '');
      })
      .catch((error) => {
        console.error('Error al cargar la foto del perfil:', error);
        if (!cancelled) {
          Alert.alert('No se pudo cargar la foto', 'Intenta abrir el menú nuevamente.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [menuVisible]);

  // Catálogo en tiempo real.
  useEffect(() => {
    if (!db) {
      setErrorInventario('No se pudo conectar con la base de datos.');
      setCargando(false);
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
        setCargando(false);
      },
      (error) => {
        console.error('Error al cargar productos:', error);
        setErrorInventario('No se pudieron cargar los productos. Verifica tu conexión.');
        setCargando(false);
      },
    );
  }, []);

  // Todos los lotes de todos los productos, agrupados por producto.
  useEffect(() => {
    if (!db) return undefined;

    return onSnapshot(
      collectionGroup(db, 'lotes'),
      (snapshot) => {
        const agrupados = {};
        snapshot.docs.forEach((documento) => {
          const productoId = documento.ref.parent.parent?.id;
          if (!productoId) return;
          if (!agrupados[productoId]) agrupados[productoId] = [];
          agrupados[productoId].push({ id: documento.id, ...documento.data() });
        });
        setLotesPorProducto(agrupados);
        setErrorLotes('');
      },
      (error) => {
        console.error('Error al cargar lotes:', error);
        setErrorLotes('No se pudieron cargar los lotes. Revisa las reglas de Firestore.');
      },
    );
  }, []);

  const lotesDe = (producto) => {
    const lotes = [...(lotesPorProducto[producto.id] ?? [])];
    const tieneDatosAnteriores = producto.lote !== undefined || producto.stock !== undefined;
    if (tieneDatosAnteriores) {
      lotes.push({
        id: `anterior-${producto.id}`,
        numero: producto.lote ? String(producto.lote) : 'Sin número',
        cantidad: Number(producto.stock) || 0,
        fechaVencimiento: producto.fechaVencimiento || '',
        creadoEn: producto.creadoEn,
        anterior: true,
      });
    }
    return ordenarLotes(lotes);
  };

  const categorias = useMemo(() => {
    const vistas = new Map();
    productos.forEach((producto) => {
      const categoria = String(producto.categoria ?? '').trim();
      if (categoria && !vistas.has(normalizar(categoria))) {
        vistas.set(normalizar(categoria), categoria);
      }
    });
    return [...vistas.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const consulta = normalizar(busqueda);
    return productos
      .filter((producto) => {
        const estado = producto.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO';
        if (estadoFiltro !== 'TODOS' && estado !== estadoFiltro) return false;
        if (categoriaFiltro !== 'TODAS' && normalizar(producto.categoria) !== normalizar(categoriaFiltro)) {
          return false;
        }
        if (!consulta) return true;
        return [producto.nombre, producto.marca, producto.categoria]
          .some((campo) => normalizar(campo).includes(consulta));
      })
      .sort((a, b) => String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), undefined, {
        sensitivity: 'base',
      }));
  }, [busqueda, categoriaFiltro, estadoFiltro, productos]);

  const totalActivos = productos.filter((producto) => producto.estado !== 'INACTIVO').length;
  const productoDetalle = productos.find((producto) => producto.id === productoDetalleId) ?? null;

  const actualizarCampo = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
    if (erroresFormulario[campo]) {
      setErroresFormulario((actual) => ({ ...actual, [campo]: undefined }));
    }
  };

  const abrirFormularioNuevo = () => {
    setProductoEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setErroresFormulario({});
    setFormularioVisible(true);
  };

  const abrirFormularioEdicion = (producto) => {
    setProductoDetalleId(null);
    setProductoEditando(producto);
    setFormulario({
      nombre: producto.nombre ?? '',
      categoria: producto.categoria ?? '',
      marca: producto.marca ?? '',
      precio: producto.precio !== undefined ? String(producto.precio) : '',
      estado: producto.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
    });
    setErroresFormulario({});
    setFormularioVisible(true);
  };

  const cerrarFormulario = () => {
    if (guardando) return;
    setFormularioVisible(false);
    setProductoEditando(null);
  };

  const validarFormulario = () => {
    const errores = {};
    const nombre = formulario.nombre.trim();
    const categoria = formulario.categoria.trim();
    const marca = formulario.marca.trim();
    const precioTexto = formulario.precio.trim().replace(',', '.');
    const precio = Number(precioTexto);

    if (!nombre) errores.nombre = 'Ingresa el nombre del producto.';
    else if (!contieneLetras(nombre)) errores.nombre = 'El nombre debe incluir al menos una letra.';

    if (!categoria) errores.categoria = 'Ingresa o elige una categoría.';
    else if (!categoriaValida(categoria)) errores.categoria = 'Solo letras y espacios.';

    if (marca && !contieneLetras(marca)) errores.marca = 'La marca debe incluir al menos una letra.';

    if (!precioTexto) errores.precio = 'Ingresa el precio de venta.';
    else if (!Number.isFinite(precio) || precio <= 0) errores.precio = 'Debe ser un número mayor que cero.';

    if (!errores.nombre) {
      const duplicado = productos.find((producto) => (
        producto.id !== productoEditando?.id
        && normalizar(producto.nombre) === normalizar(nombre)
        && normalizar(producto.marca) === normalizar(marca)
      ));
      if (duplicado) errores.nombre = 'Ya existe un producto con ese nombre y marca.';
    }

    return {
      errores,
      datos: {
        nombre,
        categoria,
        marca,
        precio: Math.round(precio * 100) / 100,
        estado: formulario.estado,
      },
    };
  };

  const guardarProducto = async () => {
    const { errores, datos } = validarFormulario();
    if (Object.keys(errores).length > 0) {
      setErroresFormulario(errores);
      return;
    }

    if (!db) {
      Alert.alert('Error', 'No se pudo conectar con la base de datos.');
      return;
    }

    setGuardando(true);
    try {
      if (productoEditando) {
        await updateDoc(doc(db, 'productos', productoEditando.id), {
          ...datos,
          actualizadoEn: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'productos'), {
          ...datos,
          creadoEn: serverTimestamp(),
        });
      }
      setFormularioVisible(false);
      setProductoEditando(null);
      setFormulario(FORMULARIO_VACIO);
    } catch (error) {
      console.error('Error al guardar producto:', error);
      Alert.alert(
        'No se pudo guardar',
        'Ocurrió un error al guardar el producto. Verifica tu conexión e inténtalo de nuevo.',
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

  const renderProducto = ({ item }) => {
    const activo = item.estado !== 'INACTIVO';
    const resumen = resumirLotes(lotesDe(item));
    const detalle = [item.categoria || 'Sin categoría', item.marca].filter(Boolean).join(' · ');

    return (
      <TouchableOpacity
        style={[styles.productCard, !activo && styles.productCardInactive]}
        activeOpacity={0.75}
        onPress={() => setProductoDetalleId(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Ver ${item.nombre || 'producto'} y sus lotes`}
      >
        <View style={[styles.productIcon, { backgroundColor: activo ? COLORS.greenSoft : '#F1F5F9' }]}>
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={24}
            color={activo ? COLORS.green : COLORS.muted}
          />
        </View>

        <View style={styles.productBody}>
          <View style={styles.productTopRow}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.nombre || 'Producto sin nombre'}
            </Text>
            <Text style={styles.productPrice}>{formatearPrecio(item.precio)}</Text>
          </View>
          <Text style={styles.productMeta} numberOfLines={1}>{detalle}</Text>

          <View style={styles.chipsRow}>
            <View style={[styles.chip, { backgroundColor: activo ? COLORS.greenSoft : '#F1F5F9' }]}>
              <View style={[styles.dot, { backgroundColor: activo ? COLORS.green : COLORS.muted }]} />
              <Text style={[styles.chipText, { color: activo ? COLORS.green : COLORS.muted }]}>
                {activo ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: COLORS.navySoft }]}>
              <Text style={[styles.chipText, { color: COLORS.navy }]}>
                Stock {resumen.stock} · {resumen.cantidad} {resumen.cantidad === 1 ? 'lote' : 'lotes'}
              </Text>
            </View>
            {resumen.vencidos > 0 ? (
              <View style={[styles.chip, { backgroundColor: COLORS.redSoft }]}>
                <Text style={[styles.chipText, { color: COLORS.red }]}>
                  {resumen.vencidos} vencido{resumen.vencidos === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
            {resumen.porVencer > 0 ? (
              <View style={[styles.chip, { backgroundColor: COLORS.amberSoft }]}>
                <Text style={[styles.chipText, { color: COLORS.amber }]}>
                  {resumen.porVencer} por vencer
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
      </TouchableOpacity>
    );
  };

  const renderEncabezadoLista = () => (
    <View>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.muted} />
        <TextInput
          placeholder="Buscar por nombre, marca o categoría"
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          value={busqueda}
          onChangeText={setBusqueda}
          accessibilityLabel="Buscar productos"
          returnKeyType="search"
        />
        {busqueda ? (
          <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryChips}
      >
        {['TODAS', ...categorias].map((categoria) => {
          const seleccionada = normalizar(categoriaFiltro) === normalizar(categoria);
          return (
            <TouchableOpacity
              key={categoria}
              style={[styles.filterChip, seleccionada && styles.filterChipSelected]}
              onPress={() => setCategoriaFiltro(categoria)}
              accessibilityRole="button"
              accessibilityState={{ selected: seleccionada }}
            >
              <Text style={[styles.filterChipText, seleccionada && styles.filterChipTextSelected]}>
                {categoria === 'TODAS' ? 'Todas' : categoria}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderText}>
          {productosFiltrados.length} {productosFiltrados.length === 1 ? 'producto' : 'productos'}
        </Text>
        <View style={styles.segmented}>
          {[
            ['TODOS', 'Todos'],
            ['ACTIVO', 'Activos'],
            ['INACTIVO', 'Inactivos'],
          ].map(([valor, etiqueta]) => (
            <TouchableOpacity
              key={valor}
              style={[styles.segment, estadoFiltro === valor && styles.segmentSelected]}
              onPress={() => setEstadoFiltro(valor)}
              accessibilityRole="button"
              accessibilityState={{ selected: estadoFiltro === valor }}
            >
              <Text style={[styles.segmentText, estadoFiltro === valor && styles.segmentTextSelected]}>
                {etiqueta}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {errorInventario ? <Text style={styles.errorBanner}>{errorInventario}</Text> : null}
      {errorLotes ? <Text style={styles.warningBanner}>{errorLotes}</Text> : null}
    </View>
  );

  const renderDetalle = () => {
    if (!productoDetalle) return null;
    const activo = productoDetalle.estado !== 'INACTIVO';
    const lotes = lotesDe(productoDetalle);
    const resumen = resumirLotes(lotes);

    return (
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitleBox}>
            <Text style={styles.sheetTitle} numberOfLines={2}>{productoDetalle.nombre}</Text>
            <Text style={styles.sheetSubtitle}>{productoDetalle.categoria || 'Sin categoría'}</Text>
          </View>
          <TouchableOpacity
            style={styles.closeCircle}
            onPress={() => setProductoDetalleId(null)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar detalle"
          >
            <Ionicons name="close" size={22} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Precio de venta</Text>
              <Text style={styles.infoValueStrong}>{formatearPrecio(productoDetalle.precio)}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Estado</Text>
              <Text style={[styles.infoValue, { color: activo ? COLORS.green : COLORS.muted }]}>
                {activo ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Marca</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{productoDetalle.marca || 'Sin marca'}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Stock vigente</Text>
              <Text style={styles.infoValue}>{resumen.stock} u.</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editButtonOutline}
            onPress={() => abrirFormularioEdicion(productoDetalle)}
            accessibilityRole="button"
          >
            <Feather name="edit-2" size={16} color={COLORS.navy} />
            <Text style={styles.editButtonOutlineText}>Editar datos del producto</Text>
          </TouchableOpacity>

          <View style={styles.lotesHeader}>
            <Text style={styles.sectionTitle}>Lotes</Text>
            <Text style={styles.lotesCount}>
              {resumen.cantidad} {resumen.cantidad === 1 ? 'lote' : 'lotes'}
            </Text>
          </View>

          {errorLotes ? <Text style={styles.warningBanner}>{errorLotes}</Text> : null}

          {lotes.length === 0 ? (
            <View style={styles.emptyLotes}>
              <MaterialCommunityIcons name="package-variant" size={36} color="#94A3B8" />
              <Text style={styles.emptyLotesTitle}>Sin lotes registrados</Text>
              <Text style={styles.emptyLotesText}>
                Los lotes se agregan al registrar una compra de este producto.
              </Text>
            </View>
          ) : (
            lotes.map((lote) => {
              const estilo = ESTILO_LOTE[estadoDelLote(lote)];
              const vence = formatearFecha(lote.fechaVencimiento);
              const ingreso = formatearFecha(lote.creadoEn);
              return (
                <View key={lote.id} style={styles.loteCard}>
                  <View style={[styles.loteStripe, { backgroundColor: estilo.color }]} />
                  <View style={styles.loteBody}>
                    <View style={styles.loteTopRow}>
                      <Text style={styles.loteNumero} numberOfLines={1}>Lote {lote.numero || 'sin número'}</Text>
                      <View style={[styles.chip, { backgroundColor: estilo.fondo }]}>
                        <Text style={[styles.chipText, { color: estilo.color }]}>{estilo.texto}</Text>
                      </View>
                    </View>
                    <View style={styles.loteDatos}>
                      <View style={styles.loteDato}>
                        <Text style={styles.infoLabel}>Cantidad</Text>
                        <Text style={styles.loteDatoValor}>{Number(lote.cantidad) || 0} u.</Text>
                      </View>
                      <View style={styles.loteDato}>
                        <Text style={styles.infoLabel}>Vence</Text>
                        <Text style={styles.loteDatoValor}>{vence || '—'}</Text>
                      </View>
                      <View style={styles.loteDato}>
                        <Text style={styles.infoLabel}>Ingreso</Text>
                        <Text style={styles.loteDatoValor}>{ingreso || '—'}</Text>
                      </View>
                    </View>
                    {lote.costoUnitario !== undefined ? (
                      <Text style={styles.loteCosto}>
                        Costo {formatearPrecio(lote.costoUnitario)} c/u
                      </Text>
                    ) : null}
                    {lote.anterior ? (
                      <Text style={styles.loteAnterior}>Registro anterior al nuevo catálogo</Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  const renderCampo = ({ campo, etiqueta, placeholder, opcional, ...props }) => (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>
        {etiqueta}
        {opcional ? <Text style={styles.optionalLabel}> (opcional)</Text> : null}
      </Text>
      <TextInput
        style={[styles.formInput, erroresFormulario[campo] && styles.formInputError]}
        value={formulario[campo]}
        onChangeText={(valor) => actualizarCampo(campo, valor)}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        editable={!guardando}
        {...props}
      />
      {erroresFormulario[campo] ? (
        <Text style={styles.fieldError}>{erroresFormulario[campo]}</Text>
      ) : null}
    </View>
  );

  const sugerenciasCategoria = categorias.filter((categoria) => {
    const consulta = normalizar(formulario.categoria);
    return normalizar(categoria) !== consulta && (!consulta || normalizar(categoria).includes(consulta));
  }).slice(0, 8);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={styles.screenTitle}>Productos</Text>
          <Text style={styles.screenSubtitle}>
            {productos.length} en catálogo · {totalActivos} activos
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Abrir menú"
        >
          <Ionicons name="menu-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={abrirFormularioNuevo}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Agregar producto"
      >
        <Ionicons name="add-circle" size={22} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Agregar producto</Text>
      </TouchableOpacity>

      <FlatList
        data={productosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderProducto}
        ListHeaderComponent={renderEncabezadoLista()}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          cargando ? (
            <Text style={styles.emptyText}>Cargando productos...</Text>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="package-variant-remove" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>
                {busqueda || estadoFiltro !== 'TODOS' || categoriaFiltro !== 'TODAS'
                  ? 'Sin resultados'
                  : 'Tu catálogo está vacío'}
              </Text>
              <Text style={styles.emptyText}>
                {busqueda || estadoFiltro !== 'TODOS' || categoriaFiltro !== 'TODAS'
                  ? 'Prueba con otra búsqueda o quita los filtros.'
                  : 'Agrega tu primer producto con el botón de arriba.'}
              </Text>
            </View>
          )
        }
      />

      {/* Detalle del producto con sus lotes */}
      <Modal
        visible={Boolean(productoDetalle)}
        transparent
        animationType="slide"
        onRequestClose={() => setProductoDetalleId(null)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback onPress={() => setProductoDetalleId(null)}>
            <View style={styles.sheetBackdrop} />
          </TouchableWithoutFeedback>
          {renderDetalle()}
        </View>
      </Modal>

      {/* Formulario: agregar / editar */}
      <Modal
        visible={formularioVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarFormulario}
      >
        <KeyboardAvoidingView
          style={styles.sheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={cerrarFormulario}>
            <View style={styles.sheetBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleBox}>
                <Text style={styles.sheetTitle}>
                  {productoEditando ? 'Editar producto' : 'Nuevo producto'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {productoEditando ? 'Actualiza los datos del catálogo' : 'Agrégalo al catálogo del almacén'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeCircle}
                onPress={cerrarFormulario}
                disabled={guardando}
                accessibilityRole="button"
                accessibilityLabel="Cerrar formulario"
              >
                <Ionicons name="close" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              {renderCampo({
                campo: 'nombre',
                etiqueta: 'Nombre',
                placeholder: 'Ej.: Arroz grado 1, 1 kg',
                maxLength: 100,
              })}

              {renderCampo({
                campo: 'categoria',
                etiqueta: 'Categoría',
                placeholder: 'Ej.: Abarrotes',
                maxLength: 60,
              })}
              {sugerenciasCategoria.length > 0 ? (
                <View style={styles.suggestions}>
                  {sugerenciasCategoria.map((categoria) => (
                    <TouchableOpacity
                      key={categoria}
                      style={styles.suggestionChip}
                      onPress={() => actualizarCampo('categoria', categoria)}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar categoría ${categoria}`}
                    >
                      <Text style={styles.suggestionText}>{categoria}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {renderCampo({
                campo: 'marca',
                etiqueta: 'Marca',
                placeholder: 'Ej.: Tucapel',
                opcional: true,
                maxLength: 60,
              })}

              {renderCampo({
                campo: 'precio',
                etiqueta: 'Precio de venta',
                placeholder: '0.00',
                keyboardType: 'decimal-pad',
                maxLength: 12,
              })}

              <Text style={styles.inputLabel}>Estado</Text>
              <View style={styles.statusOptions}>
                {[
                  ['ACTIVO', 'Activo', 'Disponible para la venta'],
                  ['INACTIVO', 'Inactivo', 'Oculto de la venta'],
                ].map(([valor, etiqueta, ayuda]) => {
                  const seleccionado = formulario.estado === valor;
                  return (
                    <TouchableOpacity
                      key={valor}
                      style={[styles.statusOption, seleccionado && styles.statusOptionSelected]}
                      onPress={() => actualizarCampo('estado', valor)}
                      disabled={guardando}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: seleccionado }}
                    >
                      <View style={[styles.radio, seleccionado && styles.radioSelected]}>
                        {seleccionado ? <View style={styles.radioInner} /> : null}
                      </View>
                      <View style={styles.statusTextBox}>
                        <Text style={styles.statusOptionText}>{etiqueta}</Text>
                        <Text style={styles.statusHelp}>{ayuda}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.saveButton, guardando && styles.saveButtonDisabled]}
                onPress={guardarProducto}
                activeOpacity={0.85}
                disabled={guardando}
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonText}>
                  {guardando
                    ? 'Guardando...'
                    : productoEditando ? 'Guardar cambios' : 'Agregar al catálogo'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Menú lateral */}
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
                  onPress={() => {
                    if (item.title === 'Producto') setMenuVisible(false);
                    if (item.title === 'Compras') {
                      setMenuVisible(false);
                      navigation.navigate('Purchases');
                    }
                  }}
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
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  titleBox: {
    flex: 1,
    marginHorizontal: 14,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  screenSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    marginHorizontal: 10,
  },
  categoryChips: {
    paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#EDEAE4',
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  segmentSelected: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
  },
  segmentTextSelected: {
    color: COLORS.text,
  },
  errorBanner: {
    backgroundColor: COLORS.redSoft,
    color: COLORS.red,
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    marginBottom: 12,
  },
  warningBanner: {
    backgroundColor: COLORS.amberSoft,
    color: COLORS.amber,
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    marginBottom: 12,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  productCardInactive: {
    opacity: 0.7,
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productBody: {
    flex: 1,
    marginRight: 6,
  },
  productTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productName: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginRight: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.coral,
  },
  productMeta: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    marginTop: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.coral,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 4,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D6D3CD',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetTitleBox: {
    flex: 1,
    marginRight: 12,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 2,
  },
  closeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoBox: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  infoValueStrong: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.coral,
  },
  editButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 22,
  },
  editButtonOutlineText: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  lotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  lotesCount: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
  },
  emptyLotes: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyLotesTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  emptyLotesText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  loteCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loteStripe: {
    width: 5,
  },
  loteBody: {
    flex: 1,
    padding: 14,
  },
  loteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loteNumero: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
    marginRight: 8,
  },
  loteDatos: {
    flexDirection: 'row',
    marginTop: 10,
  },
  loteDato: {
    flex: 1,
  },
  loteDatoValor: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  loteCosto: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 8,
  },
  loteAnterior: {
    fontSize: 11,
    color: COLORS.muted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  field: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  optionalLabel: {
    fontWeight: '400',
    color: COLORS.muted,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  formInputError: {
    borderColor: COLORS.red,
  },
  fieldError: {
    color: COLORS.red,
    fontSize: 12,
    marginTop: 5,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -6,
    marginBottom: 14,
  },
  suggestionChip: {
    backgroundColor: COLORS.navySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
    marginTop: 6,
  },
  suggestionText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  statusOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  statusOption: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  statusOptionSelected: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.greenSoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioSelected: {
    borderColor: COLORS.green,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.green,
  },
  statusTextBox: {
    flex: 1,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusHelp: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: COLORS.coral,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
