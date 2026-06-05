import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import {
  db,
  calcularCostoFIFO,
  descontarStock,
  getSesionHoy,
  actualizarTotalesSesion,
} from "../db";

function formatBs(valor) {
  return `Bs ${Number(valor).toFixed(2)}`;
}

function formatFecha(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

const FORM_VACIO = {
  productoId: "",
  cantidad: "",
  precioVenta: "",
  costoUnitario: "",
};

export default function Ventas() {
  const [vista, setVista] = useState("ventas"); // 'ventas' | 'nueva'
  const [productos, setProductos] = useState([]);
  const [ventasHoy, setVentasHoy] = useState([]);
  const [sesion, setSesion] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [costoSugerido, setCostoSugerido] = useState(null);
  const [stockDisponible, setStockDisponible] = useState(null);
  const [sinStock, setSinStock] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const costoEditadoRef = useRef(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const prods = await db.productos.orderBy("nombre").toArray();
    setProductos(prods);
    await cargarVentasHoy(prods);
  }

  async function cargarVentasHoy(prods) {
    const sesionActual = await getSesionHoy();
    setSesion(sesionActual);

    const ventas = await db.ventas
      .where("sesionId")
      .equals(sesionActual.id)
      .reverse()
      .sortBy("fecha");

    const prodMap = {};
    (prods || productos).forEach((p) => {
      prodMap[p.id] = p;
    });

    setVentasHoy(
      ventas.map((v) => ({ ...v, producto: prodMap[v.productoId] })),
    );
  }

  // Cuando cambia el producto o la cantidad, recalcular costo sugerido FIFO
  useEffect(() => {
    if (!form.productoId) {
      setCostoSugerido(null);
      setStockDisponible(null);
      setSinStock(false);
      return;
    }

    const cantidad = parseFloat(form.cantidad);

    // Calcular stock total disponible del producto
    async function calcularStock() {
      const lotes = await db.lotes
        .where("productoId")
        .equals(parseInt(form.productoId))
        .filter((l) => l.cantidadRestante > 0)
        .toArray();

      const total = lotes.reduce((s, l) => s + l.cantidadRestante, 0);
      setStockDisponible(total);

      if (!cantidad || cantidad <= 0) {
        setCostoSugerido(null);
        setSinStock(false);
        return;
      }

      if (total < cantidad) {
        setSinStock(true);
        setCostoSugerido(null);
        return;
      }

      setSinStock(false);
      const resultado = await calcularCostoFIFO(
        parseInt(form.productoId),
        cantidad,
      );
      if (resultado) {
        setCostoSugerido(resultado.costoPromedio);
        if (!costoEditadoRef.current) {
          setForm((f) => ({
            ...f,
            costoUnitario: resultado.costoPromedio.toFixed(2),
          }));
        }
      }
    }

    calcularStock();
  }, [form.productoId, form.cantidad]);

  function abrirNueva() {
    costoEditadoRef.current = false;
    setForm(FORM_VACIO);
    setCostoSugerido(null);
    setStockDisponible(null);
    setSinStock(false);
    setError("");
    setVista("nueva");
  }

  function cancelar() {
    costoEditadoRef.current = false;
    setVista("ventas");
    setForm(FORM_VACIO);
    setCostoSugerido(null);
    setError("");
  }

  async function confirmarVenta() {
    if (!form.productoId) {
      setError("Seleccioná un producto.");
      return;
    }

    const cantidad = parseFloat(form.cantidad);
    const precioVenta = parseFloat(form.precioVenta);
    const costoUnitario = parseFloat(form.costoUnitario);

    if (!cantidad || cantidad <= 0) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }
    if (!precioVenta || precioVenta <= 0) {
      setError("El precio de venta debe ser mayor a 0.");
      return;
    }
    if (!costoUnitario || costoUnitario < 0) {
      setError("El costo unitario no es válido.");
      return;
    }

    // Verificar stock suficiente y obtener lotes afectados
    const resultado = await calcularCostoFIFO(
      parseInt(form.productoId),
      cantidad,
    );
    if (!resultado) {
      setError("Stock insuficiente para esta venta.");
      return;
    }

    setGuardando(true);
    try {
      const sesionActual = await getSesionHoy();
      const ganancia = (precioVenta - costoUnitario) * cantidad;
      const recuperacion = costoUnitario * cantidad;
      const totalVenta = precioVenta * cantidad;

      // Registrar la venta
      await db.ventas.add({
        productoId: parseInt(form.productoId),
        sesionId: sesionActual.id,
        cantidad,
        precioVenta,
        costoPromedio: costoUnitario,
        ganancia,
        recuperacion,
        fecha: Date.now(),
      });

      // Descontar stock de los lotes (FIFO)
      await descontarStock(resultado.lotesAfectados);

      // Actualizar totales de la sesión del día
      await actualizarTotalesSesion(
        sesionActual.id,
        precioVenta,
        costoUnitario,
        cantidad,
      );

      await cargarDatos();
      cancelar();
    } catch {
      setError("Error al registrar la venta. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  // ── Formulario nueva venta ───────────────────────────────────────────────────
  if (vista === "nueva") {
    const cantidad = parseFloat(form.cantidad) || 0;
    const precio = parseFloat(form.precioVenta) || 0;
    const costo = parseFloat(form.costoUnitario) || 0;
    const totalVenta = precio * cantidad;
    const totalCosto = costo * cantidad;
    const ganancia = totalVenta - totalCosto;
    const hayPreview = cantidad > 0 && precio > 0 && costo >= 0;

    return (
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <button onClick={cancelar} className="btn btn-ghost" style={{ height: "34px", padding: "0 12px" }}>
            <ArrowLeft size={15} /> Volver
          </button>
          <h2>Nueva venta</h2>
        </div>

        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {/* Producto */}
          <div className="input-group">
            <label>Producto</label>
            <select
              className="input"
              value={form.productoId}
              onChange={(e) => {
                costoEditadoRef.current = false;
                setForm((f) => ({
                  ...f,
                  productoId: e.target.value,
                  cantidad: "",
                  costoUnitario: "",
                }));
              }}
            >
              <option value="">— Seleccioná un producto —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {stockDisponible !== null && (
              <span
                style={{
                  fontSize: "0.78rem",
                  color:
                    stockDisponible > 0
                      ? "var(--color-success)"
                      : "var(--color-danger)",
                  marginTop: "2px",
                }}
              >
                Stock disponible: {stockDisponible}{" "}
                {productos.find((p) => String(p.id) === form.productoId)
                  ?.unidad ?? ""}
                s
              </span>
            )}
          </div>

          {/* Cantidad */}
          <div className="input-group">
            <label>Cantidad</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder="Ej: 3"
              min="0.01"
              step="0.01"
              value={form.cantidad}
              onChange={(e) =>
                setForm((f) => ({ ...f, cantidad: e.target.value }))
              }
            />
            {sinStock && (
              <span
                style={{
                  fontSize: "0.78rem",
                  color: "var(--color-danger)",
                  marginTop: "2px",
                }}
              >
                Stock insuficiente para esta cantidad.
              </span>
            )}
          </div>

          {/* Precio de venta */}
          <div className="input-group">
            <label>Precio de venta (Bs)</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder="Ej: 18.00"
              min="0.01"
              step="0.01"
              value={form.precioVenta}
              onChange={(e) =>
                setForm((f) => ({ ...f, precioVenta: e.target.value }))
              }
            />
          </div>

          {/* Costo unitario — prellenado por FIFO, editable */}
          <div className="input-group">
            <label>
              Costo unitario de compra (Bs)
              {costoSugerido !== null && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-2)",
                    fontWeight: 400,
                    marginLeft: "6px",
                  }}
                >
                  · sugerido por FIFO: {formatBs(costoSugerido)}
                </span>
              )}
            </label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder="Ej: 12.50"
              min="0"
              step="0.01"
              value={form.costoUnitario}
              onChange={(e) => {
                costoEditadoRef.current = true;
                setForm((f) => ({ ...f, costoUnitario: e.target.value }));
              }}
            />
          </div>

          {/* Vista previa de la venta */}
          {hayPreview && (
            <div
              style={{
                background: "var(--color-surface2)",
                borderRadius: "var(--radius-md)",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <p
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--color-text-2)",
                  marginBottom: "2px",
                }}
              >
                RESUMEN DE VENTA
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.875rem",
                }}
              >
                <span className="text-muted">Total vendido</span>
                <span style={{ fontWeight: 500 }}>{formatBs(totalVenta)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.875rem",
                }}
              >
                <span className="text-muted">Recuperación capital</span>
                <span
                  style={{ fontWeight: 500, color: "var(--color-warning)" }}
                >
                  {formatBs(totalCosto)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.95rem",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--color-border)",
                }}
              >
                <span style={{ fontWeight: 600 }}>Ganancia</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      ganancia >= 0
                        ? "var(--color-success)"
                        : "var(--color-danger)",
                  }}
                >
                  {formatBs(ganancia)}
                </span>
              </div>
            </div>
          )}

          {error && <div className="alert alert-danger">{error}</div>}

          <button
            className="btn btn-primary btn-full"
            onClick={confirmarVenta}
            disabled={guardando || sinStock}
            style={{ marginTop: "4px" }}
          >
            {guardando ? "Registrando..." : "Confirmar venta"}
          </button>
        </div>
      </div>
    );
  }

  // ── Lista de ventas del día ──────────────────────────────────────────────────
  const ventasFiltradas = ventasHoy.filter((v) =>
    v.producto?.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ fontSize: "1.1rem" }}>Ventas de hoy</h2>
        <button
          className="btn btn-primary"
          style={{ height: "36px", padding: "0 14px", fontSize: "0.85rem" }}
          onClick={abrirNueva}
        >
          <Plus size={16} /> Venta
        </button>
      </div>

      {/* Totales del día */}
      {sesion && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              background: "var(--color-surface2)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
            }}
          >
            <p
              style={{
                fontSize: "0.7rem",
                color: "var(--color-text-2)",
                marginBottom: "4px",
              }}
            >
              VENDIDO
            </p>
            <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              {formatBs(sesion.totalVendido)}
            </p>
          </div>
          <div
            style={{
              background: "var(--color-surface2)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
            }}
          >
            <p
              style={{
                fontSize: "0.7rem",
                color: "var(--color-text-2)",
                marginBottom: "4px",
              }}
            >
              CAPITAL
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--color-warning)",
              }}
            >
              {formatBs(sesion.totalRecuperacion)}
            </p>
          </div>
          <div
            style={{
              background: "var(--color-surface2)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
            }}
          >
            <p
              style={{
                fontSize: "0.7rem",
                color: "var(--color-text-2)",
                marginBottom: "4px",
              }}
            >
              GANANCIA
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--color-success)",
              }}
            >
              {formatBs(sesion.totalGanancia)}
            </p>
          </div>
        </div>
      )}

      <input
        className="input"
        type="search"
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ marginBottom: "12px" }}
      />

      {ventasFiltradas.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            marginTop: "48px",
            color: "var(--color-text-2)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🛒</div>
          <p style={{ fontSize: "0.9rem" }}>
            {busqueda
              ? "Sin resultados."
              : "Sin ventas hoy. Registrá la primera."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {ventasFiltradas.map((venta) => (
            <div
              key={venta.id}
              className="card"
              style={{ padding: "14px 16px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: 500,
                      fontSize: "0.9rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {venta.producto?.nombre ?? "Producto eliminado"}
                  </p>
                  <p
                    className="text-muted text-small"
                    style={{ marginTop: "2px" }}
                  >
                    {venta.cantidad} u · {formatFecha(venta.fecha)}
                  </p>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    flexShrink: 0,
                    marginLeft: "12px",
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {formatBs(venta.precioVenta * venta.cantidad)}
                  </p>
                  <p
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--color-success)",
                      marginTop: "2px",
                    }}
                  >
                    +{formatBs(venta.ganancia)}
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "10px",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--color-border)",
                  fontSize: "0.78rem",
                }}
              >
                <span className="text-muted">
                  Venta: {formatBs(venta.precioVenta)}/u
                </span>
                <span className="text-muted">
                  Costo: {formatBs(venta.costoPromedio)}/u
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
