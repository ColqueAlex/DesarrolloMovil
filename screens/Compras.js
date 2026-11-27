import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
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
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';
import {
  fechaTextoAISO,
  hoyISO,
  isoDentroDeAnios,
  parsearMonto,
  validarCantidad,
  validarMonto,
  validarNumeroLote,
} from '../src/utils/validaciones';

/*
 * Registro de compras.
 *
 * compras/{compraId}
 *   fecha ('AAAA-MM-DD'), total, cantidadProductos, creadoPor, creadoEn,
 *   items: [{ productoId, nombre, loteId, numeroLote, cantidad,
 *             costoUnitario, subtotal, fechaVencimiento }]
 *
 * Cada ítem crea un lote en productos/{productoId}/lotes/{loteId}
 *   numero, cantidad, costoUnitario, fechaVencimiento, compraId, fechaCompra, creadoEn
 *
 * La compra y sus lotes se guardan juntos (writeBatch): o se guarda todo o nada.
 */

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
  red: '#C2410C',
  redSoft: '#FDE8E3',
};

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const ITEM_VACIO = {
  numeroLote: '',
  cantidad: '',
  costoUnitario: '',
  vencimiento: '',
};

const normalizar = (valor) => String(valor ?? '').trim().toLocaleLowerCase();

const formatearPrecio = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? `$${numero.toFixed(2)}` : '—';
};

const redondear = (valor) => Math.round(valor * 100) / 100;

const ANIOS_MAX_VENCIMIENTO = 10;


// 'AAAA-MM-DD' -> 'DD/MM/AAAA'
const isoADisplay = (iso) => {
  const partes = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : '';
};

// Agrega las barras mientras se escribe: 26112026 -> 26/11/2026
const mascaraFecha = (texto) => {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
};


const fechaLarga = (iso) => {
  const partes = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) return 'Sin fecha';
  return `${Number(partes[3])} de ${MONTHS[Number(partes[2]) - 1]} de ${partes[1]}`;
};


export default function Compras({ navigation }) {
  const [compras, setCompras] = useState([]);
  const [productos, setProductos] = useState([]);
  const [lotesPorProducto, setLotesPorProducto] = useState({});
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [compraDetalle, setCompraDetalle] = useState(null);

  // Registro de una compra nueva.
  const [registroVisible, setRegistroVisible] = useState(false);
  const [paso, setPaso] = useState('resumen'); // 'resumen' | 'elegirProducto' | 'item'
  const [fechaCompra, setFechaCompra] = useState('');
  const [errorFecha, setErrorFecha] = useState('');
  const [items, setItems] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [itemEditandoIndex, setItemEditandoIndex] = useState(null);
  const [itemForm, setItemForm] = useState(ITEM_VACIO);
  const [erroresItem, setErroresItem] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!db) {
      setErrorCarga('No se pudo conectar con la base de datos.');
      setCargando(false);
      return undefined;
    }

    const dejarCompras = onSnapshot(
      collection(db, 'compras'),
      (snapshot) => {
        setCompras(snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() })));
        setErrorCarga('');
        setCargando(false);
      },
      (error) => {
        console.error('Error al cargar compras:', error);
        setErrorCarga('No se pudieron cargar las compras. Revisa tu conexión y las reglas de Firestore.');
        setCargando(false);
      },
    );

    const dejarProductos = onSnapshot(
      collection(db, 'productos'),
      (snapshot) => {
        setProductos(snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() })));
      },
      (error) => console.error('Error al cargar productos:', error),
    );

    // Para no repetir un número de lote dentro del mismo producto.
    const dejarLotes = onSnapshot(
      collectionGroup(db, 'lotes'),
      (snapshot) => {
        const agrupados = {};
        snapshot.docs.forEach((documento) => {
          const productoId = documento.ref.parent.parent?.id;
          if (!productoId) return;
          if (!agrupados[productoId]) agrupados[productoId] = [];
          agrupados[productoId].push(normalizar(documento.data().numero));
        });
        setLotesPorProducto(agrupados);
      },
      (error) => console.error('Error al cargar lotes:', error),
    );

    return () => {
      dejarCompras();
      dejarProductos();
      dejarLotes();
    };
  }, []);

  const comprasOrdenadas = useMemo(() => (
    [...compras].sort((a, b) => {
      const porFecha = String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''));
      if (porFecha !== 0) return porFecha;
      return (b.creadoEn?.toMillis?.() ?? Infinity) - (a.creadoEn?.toMillis?.() ?? Infinity);
    })
  ), [compras]);

  const totalDelMes = useMemo(() => {
    const mesActual = hoyISO().slice(0, 7);
    return compras
      .filter((compra) => String(compra.fecha ?? '').startsWith(mesActual))
      .reduce((suma, compra) => suma + (Number(compra.total) || 0), 0);
  }, [compras]);

  const productosDisponibles = useMemo(() => {
    const consulta = normalizar(busquedaProducto);
    return productos
      .filter((producto) => producto.estado !== 'INACTIVO')
      .filter((producto) => !consulta || [producto.nombre, producto.marca, producto.categoria]
        .some((campo) => normalizar(campo).includes(consulta)))
      .sort((a, b) => String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), undefined, {
        sensitivity: 'base',
      }));
  }, [busquedaProducto, productos]);

  const totalCompra = redondear(items.reduce((suma, item) => suma + item.subtotal, 0));

  // ---------- Registro ----------

  const abrirRegistro = () => {
    setFechaCompra(isoADisplay(hoyISO()));
    setErrorFecha('');
    setItems([]);
    setPaso('resumen');
    setRegistroVisible(true);
  };

  const cerrarRegistro = () => {
    if (guardando) return;
    if (items.length === 0) {
      setRegistroVisible(false);
      return;
    }
    Alert.alert(
      '¿Descartar la compra?',
      'Se perderán los productos que agregaste.',
      [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => setRegistroVisible(false) },
      ],
    );
  };

  const volverAtras = () => {
    if (paso === 'item' && itemEditandoIndex === null) {
      setPaso('elegirProducto');
      return;
    }
    if (paso !== 'resumen') {
      setPaso('resumen');
      return;
    }
    cerrarRegistro();
  };

  const empezarAgregarItem = () => {
    setBusquedaProducto('');
    setItemEditandoIndex(null);
    setPaso('elegirProducto');
  };

  const elegirProducto = (producto) => {
    setProductoSeleccionado(producto);
    setItemForm(ITEM_VACIO);
    setErroresItem({});
    setPaso('item');
  };

  const editarItem = (index) => {
    const item = items[index];
    setProductoSeleccionado(
      productos.find((producto) => producto.id === item.productoId)
        ?? { id: item.productoId, nombre: item.nombre },
    );
    setItemEditandoIndex(index);
    setItemForm({
      numeroLote: item.numeroLote,
      cantidad: String(item.cantidad),
      costoUnitario: String(item.costoUnitario),
      vencimiento: isoADisplay(item.fechaVencimiento),
    });
    setErroresItem({});
    setPaso('item');
  };

  const quitarItem = (index) => {
    setItems((actuales) => actuales.filter((_, i) => i !== index));
  };

  const actualizarItemForm = (campo, valor) => {
    setItemForm((actual) => ({ ...actual, [campo]: valor }));
    if (erroresItem[campo]) setErroresItem((actual) => ({ ...actual, [campo]: undefined }));
  };

  const guardarItem = () => {
    const errores = {};
    const lote = validarNumeroLote(itemForm.numeroLote);
    const cantidadValidada = validarCantidad(itemForm.cantidad);
    const costoValidado = validarMonto(itemForm.costoUnitario, { etiqueta: 'el costo unitario' });
    const numeroLote = lote.valor;
    const cantidad = cantidadValidada.valor;
    const costoUnitario = costoValidado.valor;
    let fechaVencimiento = '';

    if (lote.error) {
      errores.numeroLote = lote.error;
    } else {
      const productoId = productoSeleccionado.id;
      const yaExiste = (lotesPorProducto[productoId] ?? []).includes(normalizar(numeroLote));
      const repetidoEnCompra = items.some((item, index) => (
        index !== itemEditandoIndex
        && item.productoId === productoId
        && normalizar(item.numeroLote) === normalizar(numeroLote)
      ));
      if (yaExiste) errores.numeroLote = 'Este producto ya tiene un lote con ese número.';
      else if (repetidoEnCompra) errores.numeroLote = 'Ese lote ya está en esta compra.';
    }

    if (cantidadValidada.error) errores.cantidad = cantidadValidada.error;
    if (costoValidado.error) errores.costoUnitario = costoValidado.error;

    if (!itemForm.vencimiento.trim()) {
      errores.vencimiento = 'Ingresa la fecha de vencimiento.';
    } else {
      const iso = fechaTextoAISO(itemForm.vencimiento);
      if (!iso) errores.vencimiento = 'Fecha inválida. Usa DD/MM/AAAA.';
      else if (iso <= hoyISO()) errores.vencimiento = 'Debe ser posterior a hoy.';
      else if (iso > isoDentroDeAnios(ANIOS_MAX_VENCIMIENTO)) {
        errores.vencimiento = `No puede ser más de ${ANIOS_MAX_VENCIMIENTO} años en el futuro.`;
      } else fechaVencimiento = iso;
    }

    if (Object.keys(errores).length > 0) {
      setErroresItem(errores);
      return;
    }

    const costo = redondear(costoUnitario);
    const nuevoItem = {
      productoId: productoSeleccionado.id,
      nombre: productoSeleccionado.nombre || 'Producto',
      numeroLote,
      cantidad,
      costoUnitario: costo,
      subtotal: redondear(cantidad * costo),
      fechaVencimiento,
    };

    setItems((actuales) => (
      itemEditandoIndex === null
        ? [...actuales, nuevoItem]
        : actuales.map((item, index) => (index === itemEditandoIndex ? nuevoItem : item))
    ));
    setItemEditandoIndex(null);
    setPaso('resumen');
  };

  const confirmarCompra = async () => {
    const fecha = fechaTextoAISO(fechaCompra);
    if (!fecha) {
      setErrorFecha('Fecha inválida. Usa DD/MM/AAAA.');
      return;
    }
    if (fecha > hoyISO()) {
      setErrorFecha('La fecha de compra no puede ser futura.');
      return;
    }
    if (fecha < isoDentroDeAnios(-1)) {
      setErrorFecha('La fecha de compra no puede tener más de un año de antigüedad.');
      return;
    }
    if (items.length === 0) return;
    if (!db) {
      Alert.alert('Error', 'No se pudo conectar con la base de datos.');
      return;
    }

    setGuardando(true);
    try {
      const batch = writeBatch(db);
      const compraRef = doc(collection(db, 'compras'));

      const itemsGuardados = items.map((item) => {
        const loteRef = doc(collection(db, 'productos', item.productoId, 'lotes'));
        batch.set(loteRef, {
          numero: item.numeroLote,
          cantidad: item.cantidad,
          costoUnitario: item.costoUnitario,
          fechaVencimiento: item.fechaVencimiento,
          compraId: compraRef.id,
          fechaCompra: fecha,
          creadoEn: serverTimestamp(),
        });
        return { ...item, loteId: loteRef.id };
      });

      batch.set(compraRef, {
        fecha,
        items: itemsGuardados,
        total: totalCompra,
        cantidadProductos: items.length,
        creadoPor: auth?.currentUser?.uid ?? null,
        creadoEn: serverTimestamp(),
      });

      await batch.commit();
      setRegistroVisible(false);
      setItems([]);
      Alert.alert('Compra registrada', `Se agregaron ${items.length} ${items.length === 1 ? 'lote' : 'lotes'} al inventario.`);
    } catch (error) {
      console.error('Error al registrar compra:', error);
      Alert.alert(
        'No se pudo registrar',
        'No se guardó nada. Verifica tu conexión y las reglas de Firestore e inténtalo de nuevo.',
      );
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Render ----------

  const renderCompra = ({ item }) => {
    const cantidad = item.cantidadProductos ?? item.items?.length ?? 0;
    const nombres = (item.items ?? []).map((detalle) => detalle.nombre).join(', ');
    return (
      <TouchableOpacity
        style={styles.compraCard}
        activeOpacity={0.75}
        onPress={() => setCompraDetalle(item)}
        accessibilityRole="button"
        accessibilityLabel={`Compra del ${fechaLarga(item.fecha)}`}
      >
        <View style={styles.compraIcon}>
          <MaterialCommunityIcons name="truck-delivery-outline" size={24} color={COLORS.coral} />
        </View>
        <View style={styles.compraBody}>
          <View style={styles.rowBetween}>
            <Text style={styles.compraFecha}>{fechaLarga(item.fecha)}</Text>
            <Text style={styles.compraTotal}>{formatearPrecio(item.total)}</Text>
          </View>
          <Text style={styles.compraMeta} numberOfLines={1}>
            {cantidad} {cantidad === 1 ? 'producto' : 'productos'} · {nombres}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
      </TouchableOpacity>
    );
  };

  const renderCampoItem = ({ campo, etiqueta, opcional, ...props }) => (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>
        {etiqueta}
        {opcional ? <Text style={styles.optionalLabel}> (opcional)</Text> : null}
      </Text>
      <TextInput
        style={[styles.formInput, erroresItem[campo] && styles.formInputError]}
        value={itemForm[campo]}
        onChangeText={(valor) => actualizarItemForm(campo, valor)}
        placeholderTextColor="#94A3B8"
        {...props}
      />
      {erroresItem[campo] ? <Text style={styles.fieldError}>{erroresItem[campo]}</Text> : null}
    </View>
  );

  const tituloPaso = {
    resumen: 'Nueva compra',
    elegirProducto: 'Elegir producto',
    item: itemEditandoIndex === null ? 'Datos del lote' : 'Editar lote',
  }[paso];

  const renderPasoResumen = () => (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.registroContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.inputLabel}>Fecha de compra</Text>
        <TextInput
          style={[styles.formInput, errorFecha && styles.formInputError]}
          value={fechaCompra}
          onChangeText={(valor) => {
            setFechaCompra(mascaraFecha(valor));
            setErrorFecha('');
          }}
          placeholder="DD/MM/AAAA"
          placeholderTextColor="#94A3B8"
          keyboardType="number-pad"
          maxLength={10}
          editable={!guardando}
        />
        {errorFecha ? <Text style={styles.fieldError}>{errorFecha}</Text> : null}

        <View style={[styles.rowBetween, styles.itemsHeader]}>
          <Text style={styles.sectionTitle}>Productos</Text>
          <Text style={styles.mutedText}>{items.length}</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyItems}>
            <MaterialCommunityIcons name="basket-plus-outline" size={36} color="#94A3B8" />
            <Text style={styles.emptyItemsText}>Agrega los productos que llegaron en esta compra.</Text>
          </View>
        ) : (
          items.map((item, index) => (
            <View key={`${item.productoId}-${item.numeroLote}`} style={styles.itemCard}>
              <TouchableOpacity
                style={styles.itemBody}
                onPress={() => editarItem(index)}
                disabled={guardando}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${item.nombre}`}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.itemNombre} numberOfLines={1}>{item.nombre}</Text>
                  <Text style={styles.itemSubtotal}>{formatearPrecio(item.subtotal)}</Text>
                </View>
                <Text style={styles.itemMeta}>
                  Lote {item.numeroLote} · {item.cantidad} u. × {formatearPrecio(item.costoUnitario)}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.fechaVencimiento ? `Vence ${isoADisplay(item.fechaVencimiento)}` : 'Sin vencimiento'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => quitarItem(index)}
                disabled={guardando}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${item.nombre}`}
              >
                <Feather name="trash-2" size={18} color={COLORS.red} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          style={styles.addItemButton}
          onPress={empezarAgregarItem}
          disabled={guardando}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color={COLORS.navy} />
          <Text style={styles.addItemText}>Agregar producto</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.mutedText}>Total de la compra</Text>
          <Text style={styles.footerTotal}>{formatearPrecio(totalCompra)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.confirmButton, (items.length === 0 || guardando) && styles.buttonDisabled]}
          onPress={confirmarCompra}
          disabled={items.length === 0 || guardando}
          accessibilityRole="button"
        >
          <Text style={styles.confirmButtonText}>{guardando ? 'Guardando...' : 'Registrar compra'}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderPasoElegirProducto = () => (
    <View style={styles.flex}>
      <View style={styles.pickerSearch}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            value={busquedaProducto}
            onChangeText={setBusquedaProducto}
            placeholder="Buscar producto"
            placeholderTextColor="#94A3B8"
            autoFocus
          />
        </View>
      </View>
      <FlatList
        data={productosDisponibles}
        keyExtractor={(producto) => producto.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.registroContent}
        renderItem={({ item: producto }) => (
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => elegirProducto(producto)}
            accessibilityRole="button"
          >
            <View style={styles.pickerIcon}>
              <MaterialCommunityIcons name="package-variant-closed" size={22} color={COLORS.green} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.itemNombre} numberOfLines={1}>{producto.nombre}</Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {[producto.categoria, producto.marca].filter(Boolean).join(' · ') || 'Sin categoría'}
              </Text>
            </View>
            <Ionicons name="add-circle-outline" size={22} color={COLORS.navy} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {productos.length === 0
              ? 'No hay productos en el catálogo. Agrégalos primero en Productos.'
              : 'No se encontró ningún producto activo con esa búsqueda.'}
          </Text>
        }
      />
    </View>
  );

  const renderPasoItem = () => {
    const cantidad = /^\d+$/.test(itemForm.cantidad.trim()) ? Number(itemForm.cantidad) : NaN;
    const costo = parsearMonto(itemForm.costoUnitario);
    const precioVenta = Number(productoSeleccionado?.precio);
    const costoSuperaVenta = Number.isFinite(costo) && Number.isFinite(precioVenta) && precioVenta > 0
      && costo >= precioVenta;
    const subtotal = Number.isFinite(cantidad) && Number.isFinite(costo) ? cantidad * costo : 0;

    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.registroContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.selectedProduct}>
          <View style={styles.pickerIcon}>
            <MaterialCommunityIcons name="package-variant-closed" size={22} color={COLORS.green} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.itemNombre} numberOfLines={2}>{productoSeleccionado?.nombre}</Text>
            {productoSeleccionado?.precio !== undefined ? (
              <Text style={styles.itemMeta}>Precio de venta {formatearPrecio(productoSeleccionado.precio)}</Text>
            ) : null}
          </View>
        </View>

        {renderCampoItem({
          campo: 'numeroLote',
          etiqueta: 'N° de lote',
          placeholder: 'Ej.: 240915A',
          autoCapitalize: 'characters',
          autoCorrect: false,
          maxLength: 30,
        })}

        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            {renderCampoItem({
              campo: 'cantidad',
              etiqueta: 'Cantidad',
              placeholder: '0',
              keyboardType: 'number-pad',
              maxLength: 6,
            })}
          </View>
          <View style={styles.formColumn}>
            {renderCampoItem({
              campo: 'costoUnitario',
              etiqueta: 'Costo unitario',
              placeholder: 'Ej.: 850,50',
              keyboardType: 'decimal-pad',
              maxLength: 15,
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.inputLabel}>
            Fecha de vencimiento
          </Text>
          <TextInput
            style={[styles.formInput, erroresItem.vencimiento && styles.formInputError]}
            value={itemForm.vencimiento}
            onChangeText={(valor) => actualizarItemForm('vencimiento', mascaraFecha(valor))}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            maxLength={10}
          />
          {erroresItem.vencimiento ? <Text style={styles.fieldError}>{erroresItem.vencimiento}</Text> : null}
        </View>

        <View style={styles.subtotalBox}>
          <Text style={styles.mutedText}>Subtotal</Text>
          <Text style={styles.subtotalValue}>{formatearPrecio(subtotal > 0 ? subtotal : 0)}</Text>
        </View>
        {costoSuperaVenta ? (
          <Text style={styles.warningText}>
            Ojo: el costo es igual o mayor que el precio de venta ({formatearPrecio(precioVenta)}).
            Puedes guardarlo igual, pero no dejaría ganancia.
          </Text>
        ) : null}

        <TouchableOpacity style={styles.saveButton} onPress={guardarItem} accessibilityRole="button">
          <Text style={styles.saveButtonText}>
            {itemEditandoIndex === null ? 'Agregar a la compra' : 'Guardar cambios'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={styles.screenTitle}>Compras</Text>
          <Text style={styles.screenSubtitle}>Este mes: {formatearPrecio(totalDelMes)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={abrirRegistro}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Ionicons name="add-circle" size={22} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Registrar compra</Text>
      </TouchableOpacity>

      {errorCarga ? <Text style={styles.errorBanner}>{errorCarga}</Text> : null}

      <FlatList
        data={comprasOrdenadas}
        keyExtractor={(compra) => compra.id}
        renderItem={renderCompra}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          comprasOrdenadas.length > 0 ? <Text style={styles.listTitle}>Historial</Text> : null
        }
        ListEmptyComponent={
          cargando ? (
            <Text style={styles.emptyText}>Cargando compras...</Text>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Aún no hay compras</Text>
              <Text style={styles.emptyText}>
                Registra la mercadería que llega y se crearán los lotes de cada producto.
              </Text>
            </View>
          )
        }
      />

      {/* Detalle de una compra del historial */}
      <Modal
        visible={Boolean(compraDetalle)}
        transparent
        animationType="slide"
        onRequestClose={() => setCompraDetalle(null)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback onPress={() => setCompraDetalle(null)}>
            <View style={styles.sheetBackdrop} />
          </TouchableWithoutFeedback>
          {compraDetalle ? (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={styles.flex}>
                  <Text style={styles.sheetTitle}>Compra</Text>
                  <Text style={styles.screenSubtitle}>{fechaLarga(compraDetalle.fecha)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeCircle}
                  onPress={() => setCompraDetalle(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar detalle"
                >
                  <Ionicons name="close" size={22} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.registroContent}>
                {(compraDetalle.items ?? []).map((item) => (
                  <View key={item.loteId ?? `${item.productoId}-${item.numeroLote}`} style={styles.itemCard}>
                    <View style={styles.itemBody}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.itemNombre} numberOfLines={1}>{item.nombre}</Text>
                        <Text style={styles.itemSubtotal}>{formatearPrecio(item.subtotal)}</Text>
                      </View>
                      <Text style={styles.itemMeta}>
                        Lote {item.numeroLote} · {item.cantidad} u. × {formatearPrecio(item.costoUnitario)}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {item.fechaVencimiento ? `Vence ${isoADisplay(item.fechaVencimiento)}` : 'Sin vencimiento'}
                      </Text>
                    </View>
                  </View>
                ))}
                <View style={[styles.rowBetween, styles.detailTotal]}>
                  <Text style={styles.sectionTitle}>Total</Text>
                  <Text style={styles.footerTotal}>{formatearPrecio(compraDetalle.total)}</Text>
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Registro de compra (pantalla completa, por pasos) */}
      <Modal visible={registroVisible} animationType="slide" onRequestClose={volverAtras}>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={volverAtras}
                disabled={guardando}
                accessibilityRole="button"
                accessibilityLabel={paso === 'resumen' ? 'Cerrar' : 'Volver'}
              >
                <Ionicons name={paso === 'resumen' ? 'close' : 'arrow-back'} size={22} color={COLORS.text} />
              </TouchableOpacity>
              <View style={styles.titleBox}>
                <Text style={styles.screenTitle}>{tituloPaso}</Text>
              </View>
            </View>

            {paso === 'resumen' ? renderPasoResumen() : null}
            {paso === 'elegirProducto' ? renderPasoElegirProducto() : null}
            {paso === 'item' ? renderPasoItem() : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  errorBanner: {
    backgroundColor: COLORS.redSoft,
    color: COLORS.red,
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  compraCard: {
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
  compraIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.coralSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  compraBody: {
    flex: 1,
    marginRight: 6,
  },
  compraFecha: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
    marginRight: 8,
  },
  compraTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.coral,
  },
  compraMeta: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 3,
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
  mutedText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  registroContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  itemsHeader: {
    marginTop: 22,
    marginBottom: 12,
  },
  emptyItems: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyItemsText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemBody: {
    flex: 1,
    padding: 14,
  },
  itemNombre: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
    marginRight: 8,
  },
  itemSubtotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  itemMeta: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 3,
  },
  removeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  addItemText: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerTotal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  confirmButton: {
    backgroundColor: COLORS.coral,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 22,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  pickerSearch: {
    paddingHorizontal: 20,
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
    marginLeft: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.greenSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedProduct: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  field: {
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formColumn: {
    width: '48.5%',
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
  subtotalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navySoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  warningText: {
    color: '#B7791F',
    backgroundColor: '#FDF3E1',
    fontSize: 13,
    padding: 12,
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 18,
  },
  subtotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.navy,
  },
  saveButton: {
    backgroundColor: COLORS.coral,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
    maxHeight: '85%',
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
  sheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
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
  detailTotal: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
