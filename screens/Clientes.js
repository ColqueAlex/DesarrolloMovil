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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';
import {
  claveTexto,
  limpiarEspacios,
  validarMonto,
  validarNombrePersona,
  validarTelefonoAR,
} from '../src/utils/validaciones';

/*
 * Cuentas de clientes.
 *
 * clientes/{clienteId}
 *   nombre, nombreClave, telefono, saldo (lo que debe), creadoEn, actualizadoEn
 *
 * clientes/{clienteId}/movimientos/{movimientoId}
 *   tipo ('SALDO_INICIAL' | 'PAGO' | 'CARGO'), monto, saldoAnterior, saldoNuevo,
 *   creadoPor, creadoEn
 *
 * nombresClientes/{nombreClave}  → { clienteId }
 *   Reserva el nombre: Firestore no deja crear dos documentos con el mismo id,
 *   así que dos clientes nunca pueden quedar con el mismo nombre.
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
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const FORM_VACIO = { nombre: '', telefono: '', saldoInicial: '' };

const ESTILO_MOVIMIENTO = {
  PAGO: { texto: 'Pago', icono: 'cash-check', color: COLORS.green, fondo: COLORS.greenSoft, signo: '−' },
  CARGO: { texto: 'Compra fiada', icono: 'cart-outline', color: COLORS.coral, fondo: COLORS.coralSoft, signo: '+' },
  SALDO_INICIAL: { texto: 'Saldo inicial', icono: 'notebook-outline', color: COLORS.navy, fondo: COLORS.navySoft, signo: '+' },
};

// "  José   Pérez " -> "jose perez" (sin tildes, minúsculas, un solo espacio).
// Se usa como id del documento que reserva el nombre.
const claveNombre = (nombre) => claveTexto(nombre).replace(/\//g, '-');

const limpiarNombre = limpiarEspacios;

// Escribe cada palabra con mayúscula inicial: "maría  pérez" -> "María Pérez".
const capitalizarNombre = (nombre) => limpiarNombre(nombre)
  .split(' ')
  .map((palabra) => palabra.charAt(0).toLocaleUpperCase() + palabra.slice(1))
  .join(' ');

const redondear = (valor) => Math.round(valor * 100) / 100;

const formatearPrecio = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? `$${numero.toFixed(2)}` : '—';
};

const formatearFechaHora = (timestamp) => {
  const fecha = timestamp?.toDate?.();
  if (!fecha) return 'Ahora';
  const hora = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  return `${fecha.getDate()} ${MONTHS[fecha.getMonth()]} ${fecha.getFullYear()} · ${hora}`;
};

const iniciales = (nombre) => limpiarNombre(nombre)
  .split(' ')
  .slice(0, 2)
  .map((parte) => parte.charAt(0).toUpperCase())
  .join('') || '?';

export default function Clientes({ navigation }) {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('TODOS');

  // Agregar cliente
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [erroresForm, setErroresForm] = useState({});
  const [guardando, setGuardando] = useState(false);

  // Detalle y pago
  const [clienteId, setClienteId] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [modoPago, setModoPago] = useState(false);
  const [montoPago, setMontoPago] = useState('');
  const [errorPago, setErrorPago] = useState('');
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    if (!db) {
      setErrorCarga('No se pudo conectar con la base de datos.');
      setCargando(false);
      return undefined;
    }
    return onSnapshot(
      collection(db, 'clientes'),
      (snapshot) => {
        setClientes(snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() })));
        setErrorCarga('');
        setCargando(false);
      },
      (error) => {
        console.error('Error al cargar clientes:', error);
        setErrorCarga('No se pudieron cargar los clientes. Revisa tu conexión y las reglas de Firestore.');
        setCargando(false);
      },
    );
  }, []);

  // Movimientos del cliente abierto.
  useEffect(() => {
    if (!db || !clienteId) {
      setMovimientos([]);
      return undefined;
    }
    return onSnapshot(
      query(collection(db, 'clientes', clienteId, 'movimientos'), orderBy('creadoEn', 'desc')),
      (snapshot) => {
        setMovimientos(snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() })));
      },
      (error) => console.error('Error al cargar movimientos:', error),
    );
  }, [clienteId]);

  const cliente = clientes.find((item) => item.id === clienteId) ?? null;
  const saldoCliente = Number(cliente?.saldo) || 0;

  const totalPorCobrar = useMemo(
    () => redondear(clientes.reduce((suma, item) => suma + (Number(item.saldo) || 0), 0)),
    [clientes],
  );
  const conDeuda = clientes.filter((item) => (Number(item.saldo) || 0) > 0).length;

  const clientesFiltrados = useMemo(() => {
    const consulta = claveNombre(busqueda);
    return clientes
      .filter((item) => {
        const saldo = Number(item.saldo) || 0;
        if (filtro === 'DEUDA' && saldo <= 0) return false;
        if (filtro === 'AL_DIA' && saldo > 0) return false;
        if (!consulta) return true;
        const digitosBusqueda = busqueda.replace(/\D/g, '');
        const digitosTelefono = String(item.telefono ?? '').replace(/\D/g, '');
        return claveNombre(item.nombre).includes(consulta)
          || (digitosBusqueda.length >= 3 && digitosTelefono.includes(digitosBusqueda));
      })
      .sort((a, b) => {
        const porSaldo = (Number(b.saldo) || 0) - (Number(a.saldo) || 0);
        if (filtro !== 'AL_DIA' && porSaldo !== 0) return porSaldo;
        return String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), undefined, { sensitivity: 'base' });
      });
  }, [busqueda, clientes, filtro]);

  // Aviso en vivo mientras se escribe el nombre.
  const nombreRepetido = useMemo(() => {
    const clave = claveNombre(form.nombre);
    if (!clave) return null;
    return clientes.find((item) => (item.nombreClave || claveNombre(item.nombre)) === clave) ?? null;
  }, [clientes, form.nombre]);

  // ---------- Agregar cliente ----------

  const abrirFormulario = () => {
    setForm(FORM_VACIO);
    setErroresForm({});
    setFormVisible(true);
  };

  const cerrarFormulario = () => {
    if (!guardando) setFormVisible(false);
  };

  const actualizarForm = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    if (erroresForm[campo]) setErroresForm((actual) => ({ ...actual, [campo]: undefined }));
  };

  const guardarCliente = async () => {
    const errores = {};
    const nombre = capitalizarNombre(form.nombre);
    const clave = claveNombre(nombre);
    const telefonoValidado = validarTelefonoAR(form.telefono);
    const saldoValidado = validarMonto(form.saldoInicial, {
      etiqueta: 'la deuda actual',
      obligatorio: false,
      permitirCero: true,
    });
    const telefono = telefonoValidado.valor;
    const saldoInicial = saldoValidado.valor;

    const errorNombre = validarNombrePersona(nombre, {
      etiqueta: 'el nombre del cliente',
      minimo: 3,
      maximo: 60,
    });
    if (errorNombre) errores.nombre = errorNombre;
    else if (nombreRepetido) errores.nombre = `Ya existe un cliente llamado "${nombreRepetido.nombre}".`;

    if (telefonoValidado.error) errores.telefono = telefonoValidado.error;
    if (saldoValidado.error) errores.saldoInicial = saldoValidado.error;

    if (Object.keys(errores).length > 0) {
      setErroresForm(errores);
      return;
    }
    if (!db) {
      Alert.alert('Error', 'No se pudo conectar con la base de datos.');
      return;
    }

    setGuardando(true);
    try {
      await runTransaction(db, async (transaction) => {
        const nombreRef = doc(db, 'nombresClientes', clave);
        const reservado = await transaction.get(nombreRef);
        if (reservado.exists()) throw new Error('NOMBRE_DUPLICADO');

        const clienteRef = doc(collection(db, 'clientes'));
        transaction.set(nombreRef, { clienteId: clienteRef.id });
        transaction.set(clienteRef, {
          nombre,
          nombreClave: clave,
          telefono,
          saldo: saldoInicial,
          creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        });
        if (saldoInicial > 0) {
          transaction.set(doc(collection(db, 'clientes', clienteRef.id, 'movimientos')), {
            tipo: 'SALDO_INICIAL',
            monto: saldoInicial,
            saldoAnterior: 0,
            saldoNuevo: saldoInicial,
            creadoPor: auth?.currentUser?.uid ?? null,
            creadoEn: serverTimestamp(),
          });
        }
      });
      setFormVisible(false);
    } catch (error) {
      if (error.message === 'NOMBRE_DUPLICADO') {
        setErroresForm({ nombre: 'Ya existe un cliente con ese nombre.' });
      } else {
        console.error('Error al guardar cliente:', error);
        Alert.alert('No se pudo guardar', 'Verifica tu conexión y las reglas de Firestore e inténtalo de nuevo.');
      }
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Detalle y pago ----------

  const abrirCliente = (id) => {
    setClienteId(id);
    setModoPago(false);
  };

  const cerrarDetalle = () => {
    if (pagando) return;
    setClienteId(null);
    setModoPago(false);
  };

  const empezarPago = () => {
    setMontoPago('');
    setErrorPago('');
    setModoPago(true);
  };

  const montoIngresado = validarMonto(montoPago).valor ?? 0;
  const saldoRestante = Number.isFinite(montoIngresado) ? redondear(saldoCliente - montoIngresado) : saldoCliente;

  const confirmarPago = async () => {
    const { error: errorMonto, valor: monto } = validarMonto(montoPago, { etiqueta: 'el monto del pago' });
    if (errorMonto) {
      setErrorPago(errorMonto);
      return;
    }
    if (monto > saldoCliente) {
      setErrorPago(`El pago no puede superar la deuda (${formatearPrecio(saldoCliente)}).`);
      return;
    }

    setPagando(true);
    try {
      await runTransaction(db, async (transaction) => {
        const clienteRef = doc(db, 'clientes', clienteId);
        const snapshot = await transaction.get(clienteRef);
        if (!snapshot.exists()) throw new Error('NO_EXISTE');
        const saldoActual = Number(snapshot.data().saldo) || 0;
        if (monto > saldoActual) throw new Error('SALDO_CAMBIO');

        const saldoNuevo = redondear(saldoActual - monto);
        transaction.update(clienteRef, { saldo: saldoNuevo, actualizadoEn: serverTimestamp() });
        transaction.set(doc(collection(db, 'clientes', clienteId, 'movimientos')), {
          tipo: 'PAGO',
          monto,
          saldoAnterior: saldoActual,
          saldoNuevo,
          creadoPor: auth?.currentUser?.uid ?? null,
          creadoEn: serverTimestamp(),
        });
      });
      setModoPago(false);
      Alert.alert('Pago registrado', `Se registró un pago de ${formatearPrecio(monto)}.`);
    } catch (error) {
      if (error.message === 'SALDO_CAMBIO') {
        setErrorPago('El saldo cambió mientras pagabas. Revisa el monto e inténtalo otra vez.');
      } else {
        console.error('Error al registrar pago:', error);
        Alert.alert('No se pudo registrar el pago', 'No se guardó nada. Verifica tu conexión e inténtalo de nuevo.');
      }
    } finally {
      setPagando(false);
    }
  };

  // ---------- Render ----------

  const renderCliente = ({ item }) => {
    const saldo = Number(item.saldo) || 0;
    const debe = saldo > 0;
    return (
      <TouchableOpacity
        style={styles.clienteCard}
        activeOpacity={0.75}
        onPress={() => abrirCliente(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.nombre}, ${debe ? `debe ${formatearPrecio(saldo)}` : 'al día'}`}
      >
        <View style={[styles.avatar, { backgroundColor: debe ? COLORS.coralSoft : COLORS.greenSoft }]}>
          <Text style={[styles.avatarText, { color: debe ? COLORS.coral : COLORS.green }]}>
            {iniciales(item.nombre)}
          </Text>
        </View>
        <View style={styles.clienteBody}>
          <Text style={styles.clienteNombre} numberOfLines={1}>{item.nombre}</Text>
          <Text style={styles.clienteMeta} numberOfLines={1}>{item.telefono || 'Sin teléfono'}</Text>
        </View>
        <View style={styles.saldoBox}>
          {debe ? (
            <>
              <Text style={styles.saldoLabel}>Debe</Text>
              <Text style={styles.saldoDeuda}>{formatearPrecio(saldo)}</Text>
            </>
          ) : (
            <View style={[styles.chip, { backgroundColor: COLORS.greenSoft }]}>
              <Text style={[styles.chipText, { color: COLORS.green }]}>Al día</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMovimiento = (movimiento) => {
    const estilo = ESTILO_MOVIMIENTO[movimiento.tipo] ?? ESTILO_MOVIMIENTO.CARGO;
    return (
      <View key={movimiento.id} style={styles.movimientoRow}>
        <View style={[styles.movimientoIcon, { backgroundColor: estilo.fondo }]}>
          <MaterialCommunityIcons name={estilo.icono} size={20} color={estilo.color} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.movimientoTitulo}>{estilo.texto}</Text>
          <Text style={styles.clienteMeta}>{formatearFechaHora(movimiento.creadoEn)}</Text>
        </View>
        <View style={styles.movimientoMontos}>
          <Text style={[styles.movimientoMonto, { color: estilo.color }]}>
            {estilo.signo}{formatearPrecio(movimiento.monto)}
          </Text>
          <Text style={styles.clienteMeta}>Saldo {formatearPrecio(movimiento.saldoNuevo)}</Text>
        </View>
      </View>
    );
  };

  const renderDetalle = () => {
    if (!cliente) return null;
    const debe = saldoCliente > 0;

    return (
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          {modoPago ? (
            <TouchableOpacity
              style={[styles.closeCircle, styles.backCircle]}
              onPress={() => setModoPago(false)}
              disabled={pagando}
              accessibilityRole="button"
              accessibilityLabel="Volver al detalle"
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.muted} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.flex}>
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {modoPago ? 'Registrar pago' : cliente.nombre}
            </Text>
            <Text style={styles.screenSubtitle}>
              {modoPago ? cliente.nombre : cliente.telefono || 'Sin teléfono'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeCircle}
            onPress={cerrarDetalle}
            disabled={pagando}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="close" size={22} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        {modoPago ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
            <View style={styles.pagoResumen}>
              <View>
                <Text style={styles.saldoLabel}>Deuda actual</Text>
                <Text style={styles.pagoDeuda}>{formatearPrecio(saldoCliente)}</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={COLORS.muted} />
              <View style={styles.alignEnd}>
                <Text style={styles.saldoLabel}>Quedará debiendo</Text>
                <Text style={[styles.pagoDeuda, { color: saldoRestante <= 0 ? COLORS.green : COLORS.text }]}>
                  {formatearPrecio(Math.max(saldoRestante, 0))}
                </Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Monto del pago</Text>
            <View style={[styles.montoInputBox, errorPago && styles.formInputError]}>
              <Text style={styles.montoPrefix}>$</Text>
              <TextInput
                style={styles.montoInput}
                value={montoPago}
                onChangeText={(valor) => {
                  setMontoPago(valor);
                  setErrorPago('');
                }}
                placeholder="0,00"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                maxLength={15}
                autoFocus
                editable={!pagando}
              />
            </View>
            {errorPago ? <Text style={styles.fieldError}>{errorPago}</Text> : null}

            <View style={styles.quickRow}>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => {
                  setMontoPago(saldoCliente.toFixed(2));
                  setErrorPago('');
                }}
                disabled={pagando}
                accessibilityRole="button"
              >
                <Text style={styles.quickChipText}>Pagar todo ({formatearPrecio(saldoCliente)})</Text>
              </TouchableOpacity>
              {saldoCliente >= 2 ? (
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => {
                    setMontoPago(redondear(saldoCliente / 2).toFixed(2));
                    setErrorPago('');
                  }}
                  disabled={pagando}
                  accessibilityRole="button"
                >
                  <Text style={styles.quickChipText}>La mitad</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, styles.payButton, pagando && styles.buttonDisabled]}
              onPress={confirmarPago}
              disabled={pagando}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{pagando ? 'Registrando...' : 'Confirmar pago'}</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.saldoCard, { backgroundColor: debe ? COLORS.coral : COLORS.green }]}>
              <Text style={styles.saldoCardLabel}>{debe ? 'Saldo que debe' : 'Cuenta al día'}</Text>
              <Text style={styles.saldoCardValue}>{formatearPrecio(saldoCliente)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, styles.payButton, !debe && styles.buttonDisabled]}
              onPress={empezarPago}
              disabled={!debe}
              accessibilityRole="button"
              accessibilityState={{ disabled: !debe }}
            >
              <MaterialCommunityIcons name="cash-plus" size={20} color="#FFFFFF" />
              <Text style={[styles.primaryButtonText, styles.buttonTextWithIcon]}>
                {debe ? 'Registrar pago' : 'No tiene deuda pendiente'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, styles.movimientosTitle]}>Movimientos</Text>
            {movimientos.length === 0 ? (
              <Text style={styles.emptyText}>Todavía no hay movimientos en esta cuenta.</Text>
            ) : (
              movimientos.map(renderMovimiento)
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderCampo = ({ campo, etiqueta, opcional, ...props }) => (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>
        {etiqueta}
        {opcional ? <Text style={styles.optionalLabel}> (opcional)</Text> : null}
      </Text>
      <TextInput
        style={[styles.formInput, erroresForm[campo] && styles.formInputError]}
        value={form[campo]}
        onChangeText={(valor) => actualizarForm(campo, valor)}
        placeholderTextColor="#94A3B8"
        editable={!guardando}
        {...props}
      />
      {erroresForm[campo] ? <Text style={styles.fieldError}>{erroresForm[campo]}</Text> : null}
    </View>
  );

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
          <Text style={styles.screenTitle}>Clientes</Text>
          <Text style={styles.screenSubtitle}>
            {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} · {conDeuda} con deuda
          </Text>
        </View>
      </View>

      <View style={styles.porCobrarCard}>
        <View>
          <Text style={styles.porCobrarLabel}>Total por cobrar</Text>
          <Text style={styles.porCobrarValue}>{formatearPrecio(totalPorCobrar)}</Text>
        </View>
        <MaterialCommunityIcons name="account-cash-outline" size={34} color="rgba(255,255,255,0.85)" />
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={abrirFormulario}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Ionicons name="person-add" size={20} color={COLORS.navy} />
        <Text style={styles.addButtonText}>Agregar cliente</Text>
      </TouchableOpacity>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar por nombre o teléfono"
          placeholderTextColor="#94A3B8"
          accessibilityLabel="Buscar clientes"
        />
        {busqueda ? (
          <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.segmented}>
        {[
          ['TODOS', 'Todos'],
          ['DEUDA', 'Con deuda'],
          ['AL_DIA', 'Al día'],
        ].map(([valor, etiqueta]) => (
          <TouchableOpacity
            key={valor}
            style={[styles.segment, filtro === valor && styles.segmentSelected]}
            onPress={() => setFiltro(valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: filtro === valor }}
          >
            <Text style={[styles.segmentText, filtro === valor && styles.segmentTextSelected]}>{etiqueta}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {errorCarga ? <Text style={styles.errorBanner}>{errorCarga}</Text> : null}

      <FlatList
        data={clientesFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderCliente}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          cargando ? (
            <Text style={styles.emptyText}>Cargando clientes...</Text>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>
                {busqueda || filtro !== 'TODOS' ? 'Sin resultados' : 'Aún no hay clientes'}
              </Text>
              <Text style={styles.emptyText}>
                {busqueda || filtro !== 'TODOS'
                  ? 'Prueba con otra búsqueda o cambia el filtro.'
                  : 'Agrega tu primer cliente para llevar su cuenta.'}
              </Text>
            </View>
          )
        }
      />

      {/* Detalle del cliente / registrar pago */}
      <Modal visible={Boolean(cliente)} transparent animationType="slide" onRequestClose={cerrarDetalle}>
        <KeyboardAvoidingView
          style={styles.sheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={cerrarDetalle}>
            <View style={styles.sheetBackdrop} />
          </TouchableWithoutFeedback>
          {renderDetalle()}
        </KeyboardAvoidingView>
      </Modal>

      {/* Agregar cliente */}
      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={cerrarFormulario}>
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
              <View style={styles.flex}>
                <Text style={styles.sheetTitle}>Nuevo cliente</Text>
                <Text style={styles.screenSubtitle}>Abre una cuenta para fiar y registrar pagos</Text>
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

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <View style={styles.field}>
                <Text style={styles.inputLabel}>Nombre</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    (erroresForm.nombre || nombreRepetido) && styles.formInputError,
                  ]}
                  value={form.nombre}
                  onChangeText={(valor) => actualizarForm('nombre', valor)}
                  placeholder="Ej.: María González"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                  maxLength={60}
                  editable={!guardando}
                />
                {erroresForm.nombre || nombreRepetido ? (
                  <Text style={styles.fieldError}>
                    {erroresForm.nombre || `Ya existe un cliente llamado "${nombreRepetido.nombre}".`}
                  </Text>
                ) : null}
              </View>

              {renderCampo({
                campo: 'telefono',
                etiqueta: 'Teléfono',
                opcional: true,
                placeholder: 'Ej.: 11 2345-6789',
                keyboardType: 'phone-pad',
                maxLength: 20,
              })}

              {renderCampo({
                campo: 'saldoInicial',
                etiqueta: 'Deuda actual',
                opcional: true,
                placeholder: 'Ej.: 2500 o 2500,50',
                keyboardType: 'decimal-pad',
                maxLength: 15,
              })}
              <Text style={styles.helpText}>
                Si el cliente ya te debe algo (por ejemplo, de tu cuaderno), ingrésalo aquí.
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, (guardando || nombreRepetido) && styles.buttonDisabled]}
                onPress={guardarCliente}
                disabled={guardando || Boolean(nombreRepetido)}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>{guardando ? 'Guardando...' : 'Agregar cliente'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  alignEnd: {
    alignItems: 'flex-end',
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
  porCobrarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  porCobrarLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  porCobrarValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingVertical: 13,
    borderRadius: 16,
  },
  addButtonText: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
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
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    marginHorizontal: 10,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#EDEAE4',
    borderRadius: 12,
    padding: 3,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  segmentSelected: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    fontSize: 13,
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
    marginHorizontal: 20,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  clienteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  clienteBody: {
    flex: 1,
    marginRight: 8,
  },
  clienteNombre: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  clienteMeta: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  saldoBox: {
    alignItems: 'flex-end',
  },
  saldoLabel: {
    fontSize: 11,
    color: COLORS.muted,
  },
  saldoDeuda: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.coral,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
    paddingBottom: 14,
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
    marginLeft: 12,
  },
  backCircle: {
    marginLeft: 0,
    marginRight: 12,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  saldoCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  saldoCardLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
  },
  saldoCardValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.coral,
    borderRadius: 16,
    paddingVertical: 15,
  },
  payButton: {
    backgroundColor: COLORS.green,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextWithIcon: {
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  movimientosTitle: {
    marginTop: 24,
    marginBottom: 10,
  },
  movimientoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  movimientoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  movimientoTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  movimientoMontos: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  movimientoMonto: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  pagoResumen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pagoDeuda: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
  montoInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  montoPrefix: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.muted,
    marginRight: 6,
  },
  montoInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingVertical: 12,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginBottom: 22,
  },
  quickChip: {
    backgroundColor: COLORS.navySoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 4,
  },
  quickChipText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: 'bold',
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
  helpText: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: -6,
    marginBottom: 20,
  },
});
