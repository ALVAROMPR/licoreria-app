import Dexie from 'dexie';

// ─── Función de hash SHA-256 (Web Crypto API nativa) ─────────────────────────
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Definición de la base de datos ──────────────────────────────────────────
export const db = new Dexie('LicoreriaDB');

db.version(1).stores({
  usuarios:       '++id, username',
  productos:      '++id, nombre, categoria',
  lotes:          '++id, productoId, fecha',
  ventas:         '++id, productoId, sesionId, fecha',
  sesiones_venta: '++id, fecha, abierta',
});

// v2: agrega índice fechaApertura; cierra sesiones auto-creadas del modelo anterior
db.version(2).stores({
  usuarios:       '++id, username',
  productos:      '++id, nombre, categoria',
  lotes:          '++id, productoId, fecha',
  ventas:         '++id, productoId, sesionId, fecha',
  sesiones_venta: '++id, fecha, abierta, fechaApertura',
}).upgrade(tx => {
  return tx.sesiones_venta.toCollection().modify({ abierta: false });
});

// v3: agrega tabla para credenciales biométricas WebAuthn
db.version(3).stores({
  usuarios:       '++id, username',
  productos:      '++id, nombre, categoria',
  lotes:          '++id, productoId, fecha',
  ventas:         '++id, productoId, sesionId, fecha',
  sesiones_venta: '++id, fecha, abierta, fechaApertura',
  biometria:      '++id',
});

// ─── Inicialización explícita ─────────────────────────────────────────────────
export async function inicializarDB() {
  const count = await db.usuarios.count();
  if (count === 0) {
    const hash = await hashPassword('admin123');
    await db.usuarios.add({ username: 'admin', passwordHash: hash });
  }
}

// ─── Helpers de autenticación ────────────────────────────────────────────────
export async function verificarLogin(username, password) {
  const hash = await hashPassword(password);
  const usuario = await db.usuarios.where('username').equals(username).first();
  if (!usuario) return null;
  if (usuario.passwordHash !== hash) return null;
  return usuario;
}

export async function cambiarPassword(usuarioId, nuevaPassword) {
  const hash = await hashPassword(nuevaPassword);
  await db.usuarios.update(usuarioId, { passwordHash: hash });
}

// ─── Helpers de stock ────────────────────────────────────────────────────────
export async function getLotesDisponibles(productoId) {
  return await db.lotes
    .where('productoId')
    .equals(productoId)
    .filter(lote => lote.cantidadRestante > 0)
    .sortBy('fecha');
}

export async function calcularCostoFIFO(productoId, cantidadVenta) {
  const lotes = await getLotesDisponibles(productoId);

  let cantidadPendiente = cantidadVenta;
  let costoTotal = 0;
  const lotesAfectados = [];

  for (const lote of lotes) {
    if (cantidadPendiente <= 0) break;
    const cantidadUsada = Math.min(lote.cantidadRestante, cantidadPendiente);
    costoTotal += cantidadUsada * lote.costoUnitario;
    cantidadPendiente -= cantidadUsada;
    lotesAfectados.push({ loteId: lote.id, cantidadUsada, costoUnitario: lote.costoUnitario });
  }

  if (cantidadPendiente > 0) return null;
  return { costoPromedio: costoTotal / cantidadVenta, lotesAfectados };
}

export async function descontarStock(lotesAfectados) {
  await db.transaction('rw', db.lotes, async () => {
    for (const { loteId, cantidadUsada } of lotesAfectados) {
      const lote = await db.lotes.get(loteId);
      await db.lotes.update(loteId, { cantidadRestante: lote.cantidadRestante - cantidadUsada });
    }
  });
}

// ─── Helpers de biometría ────────────────────────────────────────────────────

export async function getBiometria() {
  return (await db.biometria.toCollection().first()) ?? null;
}

export async function guardarBiometria(credentialId, username) {
  await db.biometria.clear();
  await db.biometria.add({ credentialId, username });
}

export async function eliminarBiometria() {
  await db.biometria.clear();
}

// Retorna el usuario por username (usado tras autenticación biométrica)
export async function getUsuarioPorUsername(username) {
  return (await db.usuarios.where('username').equals(username).first()) ?? null;
}

// ─── Helpers de caja ─────────────────────────────────────────────────────────

// Retorna la sesión actualmente abierta, o null si la caja está cerrada
export async function getSesionAbierta() {
  const todas = await db.sesiones_venta.filter(s => !!s.abierta).toArray();
  if (todas.length === 0) return null;
  // En caso de duplicados, retornar la más reciente
  return todas.sort((a, b) => (b.fechaApertura ?? b.id) - (a.fechaApertura ?? a.id))[0];
}

// Abre la caja: crea una nueva sesión con timestamp de apertura
export async function abrirCaja() {
  const now = Date.now();
  const fecha = new Date(now).toLocaleDateString('en-CA');
  const id = await db.sesiones_venta.add({
    fecha,
    fechaApertura: now,
    fechaCierre:   null,
    totalVendido:  0,
    totalRecuperacion: 0,
    totalGanancia: 0,
    abierta: true,
  });
  return await db.sesiones_venta.get(id);
}

// Cierra la caja: registra timestamp de cierre
export async function cerrarCaja(sesionId) {
  await db.sesiones_venta.update(sesionId, {
    abierta:     false,
    fechaCierre: Date.now(),
  });
}

// Actualiza los totales de una sesión tras registrar una venta
export async function actualizarTotalesSesion(sesionId, precioVenta, costoPromedio, cantidad) {
  const sesion = await db.sesiones_venta.get(sesionId);
  const vendido     = precioVenta * cantidad;
  const recuperacion = costoPromedio * cantidad;
  const ganancia    = vendido - recuperacion;

  await db.sesiones_venta.update(sesionId, {
    totalVendido:      sesion.totalVendido      + vendido,
    totalRecuperacion: sesion.totalRecuperacion + recuperacion,
    totalGanancia:     sesion.totalGanancia     + ganancia,
  });
}

// Elimina una venta, restaura el stock (lote de devolución) y ajusta totales de sesión
export async function eliminarVenta(ventaId) {
  const venta = await db.ventas.get(ventaId);
  if (!venta) return;

  await db.lotes.add({
    productoId:       venta.productoId,
    cantidad:         venta.cantidad,
    cantidadRestante: venta.cantidad,
    costoUnitario:    venta.costoPromedio,
    proveedor:        'Anulación',
    fecha:            Date.now(),
  });

  const sesion = await db.sesiones_venta.get(venta.sesionId);
  if (sesion) {
    await db.sesiones_venta.update(venta.sesionId, {
      totalVendido:      (sesion.totalVendido      || 0) - venta.precioVenta * venta.cantidad,
      totalRecuperacion: (sesion.totalRecuperacion || 0) - venta.recuperacion,
      totalGanancia:     (sesion.totalGanancia     || 0) - venta.ganancia,
    });
  }

  await db.ventas.delete(ventaId);
}
