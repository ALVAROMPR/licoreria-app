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
  // Usuarios del sistema
  // username: identificador único
  // passwordHash: contraseña hasheada con SHA-256
  usuarios: '++id, username',

  // Catálogo de productos (sin precios fijos)
  // nombre: nombre del producto
  // categoria: tipo de bebida (cerveza, vino, destilado, etc.)
  // unidad: botella, lata, caja, etc.
  productos: '++id, nombre, categoria',

  // Entradas de stock por lote
  // productoId: referencia a productos
  // cantidad: unidades ingresadas
  // costoUnitario: precio de compra por unidad (Bs)
  // proveedor: nombre del proveedor (opcional)
  // fecha: timestamp del ingreso
  // cantidadRestante: unidades aún disponibles en este lote
  lotes: '++id, productoId, fecha',

  // Registro de ventas individuales
  // productoId: referencia a productos
  // sesionId: referencia a sesiones_venta
  // cantidad: unidades vendidas
  // precioVenta: precio real de venta (Bs)
  // costoPromedio: costo calculado (FIFO o promedio de lotes)
  // ganancia: (precioVenta - costoPromedio) * cantidad
  // recuperacion: costoPromedio * cantidad
  // fecha: timestamp de la venta
  ventas: '++id, productoId, sesionId, fecha',

  // Sesiones de venta diarias
  // fecha: fecha del día (YYYY-MM-DD)
  // totalVendido: suma de precioVenta * cantidad del día
  // totalRecuperacion: suma de costoPromedio * cantidad del día
  // totalGanancia: totalVendido - totalRecuperacion
  // abierta: true si la sesión del día está activa
  sesiones_venta: '++id, fecha, abierta',
});

// ─── Inicialización: crear usuario admin por defecto ─────────────────────────


// ─── Inicialización explícita ─────────────────────────────────────────────────
export async function inicializarDB() {
  const count = await db.usuarios.count();
  if (count === 0) {
    const hash = await hashPassword('admin123');
    await db.usuarios.add({
      username: 'admin',
      passwordHash: hash,
    });
    console.log('Usuario admin creado.');
  }
}

// ─── Helpers de autenticación ────────────────────────────────────────────────

// Verificar credenciales. Retorna el usuario si es válido, null si no.
export async function verificarLogin(username, password) {
  const hash = await hashPassword(password);
  const usuario = await db.usuarios
    .where('username')
    .equals(username)
    .first();
  if (!usuario) return null;
  if (usuario.passwordHash !== hash) return null;
  return usuario;
}

// Cambiar contraseña de un usuario
export async function cambiarPassword(usuarioId, nuevaPassword) {
  const hash = await hashPassword(nuevaPassword);
  await db.usuarios.update(usuarioId, { passwordHash: hash });
}

// ─── Helpers de stock ────────────────────────────────────────────────────────

// Obtener lotes disponibles de un producto ordenados por fecha (FIFO)
export async function getLotesDisponibles(productoId) {
  return await db.lotes
    .where('productoId')
    .equals(productoId)
    .filter(lote => lote.cantidadRestante > 0)
    .sortBy('fecha');
}

// Calcular costo FIFO para una cantidad dada de un producto
// Retorna { costoPromedio, lotesAfectados } o null si no hay stock suficiente
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

    lotesAfectados.push({
      loteId: lote.id,
      cantidadUsada,
      costoUnitario: lote.costoUnitario,
    });
  }

  if (cantidadPendiente > 0) return null; // Stock insuficiente

  const costoPromedio = costoTotal / cantidadVenta;
  return { costoPromedio, lotesAfectados };
}

// Descontar stock de los lotes afectados tras confirmar una venta
export async function descontarStock(lotesAfectados) {
  await db.transaction('rw', db.lotes, async () => {
    for (const { loteId, cantidadUsada } of lotesAfectados) {
      const lote = await db.lotes.get(loteId);
      await db.lotes.update(loteId, {
        cantidadRestante: lote.cantidadRestante - cantidadUsada,
      });
    }
  });
}

// ─── Helpers de sesión diaria ─────────────────────────────────────────────────

// Obtener o crear la sesión del día actual
export async function getSesionHoy() {
  const hoy = new Date().toISOString().split('T')[0];

  // Buscar sesión existente del día
  const sesiones = await db.sesiones_venta.toArray();
  let sesion = sesiones.find(s => s.fecha === hoy);

  if (!sesion) {
    const id = await db.sesiones_venta.add({
      fecha: hoy,
      totalVendido: 0,
      totalRecuperacion: 0,
      totalGanancia: 0,
      abierta: true,
    });
    sesion = await db.sesiones_venta.get(id);
  }

  return sesion;
}

// Actualizar totales de la sesión tras una venta
export async function actualizarTotalesSesion(sesionId, precioVenta, costoPromedio, cantidad) {
  const sesion = await db.sesiones_venta.get(sesionId);
  const vendido = precioVenta * cantidad;
  const recuperacion = costoPromedio * cantidad;
  const ganancia = vendido - recuperacion;

  await db.sesiones_venta.update(sesionId, {
    totalVendido: sesion.totalVendido + vendido,
    totalRecuperacion: sesion.totalRecuperacion + recuperacion,
    totalGanancia: sesion.totalGanancia + ganancia,
  });
}