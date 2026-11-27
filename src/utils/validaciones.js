/*
 * Validaciones compartidas por todos los formularios de la app.
 *
 * Cada función `validarX` devuelve un mensaje de error (string) o null si el
 * valor es correcto. Las que además transforman el dato (montos, teléfono,
 * DNI) devuelven { error, valor } con el valor ya normalizado para guardar.
 */

const LIMITE_MONTO = 100000000; // $ 100.000.000
const LIMITE_CANTIDAD = 100000;

/** Quita espacios de más: "  Arroz   largo " -> "Arroz largo". */
export const limpiarEspacios = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

/** Clave para comparar textos sin importar mayúsculas, tildes ni espacios. */
export const claveTexto = (texto) => limpiarEspacios(texto)
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLocaleLowerCase();

const contarLetras = (texto) => (texto.match(/\p{L}/gu) || []).length;
const contarDigitos = (texto) => (texto.match(/\d/g) || []).length;
const tieneRepeticiones = (texto) => /(.)\1{3,}/u.test(texto.replace(/\s/g, ''));

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

export const validarNombreProducto = (valor) => {
  const nombre = limpiarEspacios(valor);
  if (!nombre) return 'Ingresa el nombre del producto.';
  if (nombre.length < 3) return 'Debe tener al menos 3 caracteres.';
  if (nombre.length > 80) return 'Debe tener como máximo 80 caracteres.';
  if (!/^[\p{L}\p{M}\d\s.,'"%&()/+-]+$/u.test(nombre)) {
    return 'Usa solo letras, números y los signos . , - / % ( ) &';
  }
  if (!/^[\p{L}\d]/u.test(nombre)) return 'Debe empezar con una letra o un número.';
  if (!/\p{L}{2,}/u.test(nombre)) {
    return 'Debe incluir al menos una palabra, ej.: Arroz 1 kg.';
  }
  if (contarDigitos(nombre) > contarLetras(nombre)) {
    return 'Tiene más números que letras. Escribe el nombre del producto, ej.: Yerba 500 g.';
  }
  if (tieneRepeticiones(nombre)) return 'Tiene caracteres repetidos de más.';
  return null;
};

export const validarCategoria = (valor) => {
  const categoria = limpiarEspacios(valor);
  if (!categoria) return 'Ingresa o elige una categoría.';
  if (!/^[\p{L}\p{M}\s]+$/u.test(categoria)) return 'Solo letras y espacios.';
  if (categoria.length < 3) return 'Debe tener al menos 3 letras.';
  if (categoria.length > 40) return 'Debe tener como máximo 40 caracteres.';
  if (!/\p{L}{3,}/u.test(categoria)) return 'Debe incluir al menos una palabra de 3 letras.';
  if (tieneRepeticiones(categoria)) return 'Tiene letras repetidas de más.';
  return null;
};

/** La marca es opcional: vacía es válida. Admite marcas como "3M" o "7up". */
export const validarMarca = (valor) => {
  const marca = limpiarEspacios(valor);
  if (!marca) return null;
  if (marca.length < 2) return 'Debe tener al menos 2 caracteres.';
  if (marca.length > 40) return 'Debe tener como máximo 40 caracteres.';
  if (!/^[\p{L}\p{M}\d\s.&'-]+$/u.test(marca)) return 'Usa solo letras, números y los signos . & \' -';
  const letras = contarLetras(marca);
  if (letras === 0) return 'Debe incluir letras.';
  if (contarDigitos(marca) > letras + 1) return 'Tiene más números que letras.';
  if (tieneRepeticiones(marca)) return 'Tiene caracteres repetidos de más.';
  return null;
};

// ---------------------------------------------------------------------------
// Montos y cantidades
// ---------------------------------------------------------------------------

/**
 * Convierte un monto escrito al estilo argentino a número.
 *   "1500" -> 1500 · "1500,50" -> 1500.5 · "1.500" -> 1500 · "1.500,50" -> 1500.5
 *   "12.5" -> 12.5 (un punto seguido de 1 o 2 dígitos se toma como decimal)
 * Devuelve NaN si el formato no es válido.
 */
export const parsearMonto = (texto) => {
  let limpio = String(texto ?? '').replace(/\s|\$/g, '');
  if (!limpio) return NaN;
  if (limpio.includes(',')) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    limpio = limpio.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return NaN;
  return Number(limpio);
};

/**
 * Valida un monto en pesos. Opciones:
 *   etiqueta: texto para los mensajes ("el precio", "el costo"...)
 *   obligatorio (true), permitirCero (false), maximo (100.000.000)
 */
export const validarMonto = (texto, {
  etiqueta = 'el monto',
  obligatorio = true,
  permitirCero = false,
  maximo = LIMITE_MONTO,
} = {}) => {
  const crudo = String(texto ?? '').trim();
  if (!crudo) {
    return obligatorio ? { error: `Ingresa ${etiqueta}.`, valor: null } : { error: null, valor: 0 };
  }
  const valor = parsearMonto(crudo);
  if (!Number.isFinite(valor)) {
    return { error: 'Formato inválido. Ej.: 1500 o 1500,50 (máximo 2 decimales).', valor: null };
  }
  if (valor === 0 && !permitirCero) return { error: 'Debe ser mayor que 0.', valor: null };
  if (valor > maximo) {
    return { error: `No puede superar $${maximo.toLocaleString('es-AR')}.`, valor: null };
  }
  return { error: null, valor: Math.round(valor * 100) / 100 };
};

export const validarCantidad = (texto, { maximo = LIMITE_CANTIDAD } = {}) => {
  const crudo = String(texto ?? '').trim();
  if (!crudo) return { error: 'Ingresa la cantidad.', valor: null };
  if (!/^\d+$/.test(crudo)) return { error: 'Solo números enteros, sin puntos ni comas.', valor: null };
  const valor = Number(crudo);
  if (valor <= 0) return { error: 'Debe ser mayor que 0.', valor: null };
  if (valor > maximo) {
    return { error: `No puede superar ${maximo.toLocaleString('es-AR')} unidades.`, valor: null };
  }
  return { error: null, valor };
};

// ---------------------------------------------------------------------------
// Lotes y fechas
// ---------------------------------------------------------------------------

export const validarNumeroLote = (valor) => {
  const lote = String(valor ?? '').trim().toUpperCase();
  if (!lote) return { error: 'Ingresa el número de lote.', valor: null };
  if (lote.length > 30) return { error: 'Debe tener como máximo 30 caracteres.', valor: null };
  if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(lote)) {
    return { error: 'Solo letras sin tilde, números y guiones (sin espacios).', valor: null };
  }
  if (!/\d/.test(lote)) return { error: 'El lote debe incluir al menos un número.', valor: null };
  return { error: null, valor: lote };
};

const pad = (numero) => String(numero).padStart(2, '0');

export const fechaISO = (fecha) => `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;

export const hoyISO = () => fechaISO(new Date());

/** Suma años a hoy y devuelve 'AAAA-MM-DD'. */
export const isoDentroDeAnios = (anios) => {
  const fecha = new Date();
  fecha.setFullYear(fecha.getFullYear() + anios);
  return fechaISO(fecha);
};

/** 'DD/MM/AAAA' -> 'AAAA-MM-DD' o null si la fecha no existe (ej.: 31/02). */
export const fechaTextoAISO = (texto) => {
  const partes = String(texto ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return null;
  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const anio = Number(partes[3]);
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return null;
  }
  return fechaISO(fecha);
};

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

/**
 * Nombre o apellido de una persona: solo letras (con tildes y ñ), espacios,
 * apóstrofo y guion. Ej.: "María José", "O'Connor", "Pérez-Gómez".
 */
export const validarNombrePersona = (valor, { etiqueta = 'el nombre', minimo = 2, maximo = 50 } = {}) => {
  const nombre = limpiarEspacios(valor);
  if (!nombre) return `Ingresa ${etiqueta}.`;
  if (/\d/.test(nombre)) return 'No puede contener números.';
  if (!/^[\p{L}\p{M}]+([ '-][\p{L}\p{M}]+)*$/u.test(nombre)) {
    return 'Solo letras, espacios, apóstrofo (\') y guion (-).';
  }
  if (contarLetras(nombre) < minimo) return `Debe tener al menos ${minimo} letras.`;
  if (nombre.length > maximo) return `Debe tener como máximo ${maximo} caracteres.`;
  if (/(\p{L})\1{2,}/u.test(claveTexto(nombre))) return 'Tiene letras repetidas de más.';
  return null;
};

/**
 * DNI argentino: 7 u 8 dígitos (se aceptan puntos: 38.456.123), sin ceros
 * a la izquierda y no todos iguales. Devuelve el DNI solo con dígitos.
 */
export const validarDNI = (valor) => {
  const crudo = String(valor ?? '').trim();
  if (!crudo) return { error: 'Ingresa tu número de DNI.', valor: null };
  if (!/^[\d.\s]+$/.test(crudo)) return { error: 'El DNI solo puede tener números.', valor: null };
  const dni = crudo.replace(/[.\s]/g, '');
  if (!/^\d{7,8}$/.test(dni)) return { error: 'El DNI debe tener 7 u 8 dígitos.', valor: null };
  if (dni.startsWith('0')) return { error: 'El DNI no puede empezar con 0.', valor: null };
  if (/^(\d)\1+$/.test(dni)) return { error: 'Ingresa un DNI real.', valor: null };
  const numero = Number(dni);
  if (numero < 1000000 || numero > 99999999) {
    return { error: 'Ingresa un DNI argentino válido.', valor: null };
  }
  return { error: null, valor: dni };
};

/** 38456123 -> "38.456.123" */
export const formatearDNI = (dni) => {
  const digitos = String(dni ?? '').replace(/\D/g, '');
  return digitos ? Number(digitos).toLocaleString('es-AR') : '';
};

/**
 * Teléfono argentino. Acepta cómo lo escribe la gente:
 *   11 2345-6789 · 011 15 2345-6789 · 351 234 5678 · +54 9 11 2345-6789
 * y lo lleva a los 10 dígitos nacionales (código de área + número).
 * Devuelve null si no es un número argentino válido.
 */
export const normalizarTelefonoAR = (valor) => {
  const crudo = String(valor ?? '').trim();
  if (!/^\+?[\d\s()-]+$/.test(crudo)) return null;
  let digitos = crudo.replace(/\D/g, '');

  // Código de país (+54) y el 9 de los celulares en formato internacional.
  if (digitos.startsWith('54') && digitos.length >= 12) {
    digitos = digitos.slice(2);
    if (digitos.length === 11 && digitos.startsWith('9')) digitos = digitos.slice(1);
  }
  // Prefijo de larga distancia nacional.
  if (digitos.startsWith('0')) digitos = digitos.slice(1);
  // "15" de los celulares después del código de área (2, 3 o 4 dígitos).
  if (digitos.length === 12) {
    const largoArea = [2, 3, 4].find((largo) => digitos.slice(largo, largo + 2) === '15');
    if (largoArea) digitos = digitos.slice(0, largoArea) + digitos.slice(largoArea + 2);
  }

  if (!/^\d{10}$/.test(digitos)) return null;
  // Los códigos de área argentinos empiezan con 11, 2 o 3.
  if (!/^(11|2|3)/.test(digitos)) return null;
  if (/^(\d)\1+$/.test(digitos)) return null;
  return digitos;
};

/** "1123456789" -> "+54 11 2345-6789" · "3512345678" -> "+54 351 234-5678" */
export const formatearTelefonoAR = (nacional) => {
  const n = String(nacional ?? '');
  if (n.length !== 10) return n;
  if (n.startsWith('11')) return `+54 11 ${n.slice(2, 6)}-${n.slice(6)}`;
  return `+54 ${n.slice(0, 3)} ${n.slice(3, 6)}-${n.slice(6)}`;
};

/**
 * Valida un teléfono argentino. Devuelve { error, valor } donde valor es el
 * teléfono con formato "+54 11 2345-6789" listo para guardar ('' si es opcional
 * y quedó vacío).
 */
export const validarTelefonoAR = (valor, { obligatorio = false } = {}) => {
  const crudo = String(valor ?? '').trim();
  if (!crudo) {
    return obligatorio ? { error: 'Ingresa un número de teléfono.', valor: null } : { error: null, valor: '' };
  }
  const nacional = normalizarTelefonoAR(crudo);
  if (!nacional) {
    return {
      error: 'Ingresa un teléfono de Argentina: código de área + número (10 dígitos), ej.: 11 2345-6789 o 351 234-5678.',
      valor: null,
    };
  }
  return { error: null, valor: formatearTelefonoAR(nacional) };
};

// ---------------------------------------------------------------------------
// Correo
// ---------------------------------------------------------------------------

export const validarEmail = (valor) => {
  const email = String(valor ?? '').trim();
  if (!email) return 'Ingresa tu correo electrónico.';
  if (email.length > 254) return 'El correo es demasiado largo.';
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email) || /\.\./.test(email)) {
    return 'El formato del correo no es válido (ej. usuario@correo.com).';
  }
  return null;
};
