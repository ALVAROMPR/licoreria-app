import { useState, useEffect } from "react";
import { db } from "../db";
import { ArrowLeft, Plus, History } from "lucide-react";

const FORM_VACIO = {
  productoId: "",
  cantidad: "",
  costoUnitario: "",
  proveedor: "",
};

function formatBs(valor) {
  return `Bs ${Number(valor).toFixed(2)}`;
}

function formatFecha(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function Stock() {
  const [vista, setVista] = useState("stock"); // 'stock' | 'historial' | 'nuevo'
  const [productos, setProductos] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const prods = await db.productos.orderBy("nombre").toArray();
    setProductos(prods);
    await cargarStock(prods);
    await cargarHistorial(prods);
  }

  async function cargarStock(prods) {
    // Agrupar lotes disponibles por producto
    const lotes = await db.lotes.toArray();
    const mapa = {};

    for (const lote of lotes) {
      if (!mapa[lote.productoId]) {
        mapa[lote.productoId] = {
          totalUnidades: 0,
          costoPromedio: 0,
          costoTotal: 0,
          lotes: [],
        };
      }
      mapa[lote.productoId].totalUnidades += lote.cantidadRestante;
      mapa[lote.productoId].costoTotal +=
        lote.cantidadRestante * lote.costoUnitario;
      mapa[lote.productoId].lotes.push(lote);
    }

    // Calcular costo promedio ponderado por producto
    for (const pid in mapa) {
      const d = mapa[pid];
      d.costoPromedio =
        d.totalUnidades > 0 ? d.costoTotal / d.totalUnidades : 0;
    }

    const resultado = (prods || productos).map((p) => ({
      ...p,
      stock: mapa[p.id] || {
        totalUnidades: 0,
        costoPromedio: 0,
        costoTotal: 0,
        lotes: [],
      },
    }));

    setStockData(resultado);
  }

  async function cargarHistorial(prods) {
    const lotes = await db.lotes.orderBy("fecha").reverse().toArray();
    const prodMap = {};
    (prods || productos).forEach((p) => {
      prodMap[p.id] = p;
    });
    setHistorial(lotes.map((l) => ({ ...l, producto: prodMap[l.productoId] })));
  }

  function abrirNuevo(productoId = "") {
    setForm({ ...FORM_VACIO, productoId: String(productoId) });
    setError("");
    setVista("nuevo");
  }

  function cancelar() {
    setVista("stock");
    setForm(FORM_VACIO);
    setError("");
  }

  async function guardar() {
    if (!form.productoId) {
      setError("Seleccioná un producto.");
      return;
    }
    const cantidad = parseFloat(form.cantidad);
    const costo = parseFloat(form.costoUnitario);

    if (!cantidad || cantidad <= 0) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }
    if (!costo || costo <= 0) {
      setError("El costo unitario debe ser mayor a 0.");
      return;
    }

    setGuardando(true);
    try {
      await db.lotes.add({
        productoId: parseInt(form.productoId),
        cantidad: cantidad,
        cantidadRestante: cantidad,
        costoUnitario: costo,
        proveedor: form.proveedor.trim() || "Sin especificar",
        fecha: Date.now(),
      });
      await cargarDatos();
      cancelar();
    } catch {
      setError("Error al registrar. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  // ── Formulario nuevo lote ────────────────────────────────────────────────────
  if (vista === "nuevo") {
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
          <h2>Registrar entrada de stock</h2>
        </div>

        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div className="input-group">
            <label>Producto</label>
            <select
              className="input"
              value={form.productoId}
              onChange={(e) =>
                setForm((f) => ({ ...f, productoId: e.target.value }))
              }
            >
              <option value="">— Seleccioná un producto —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.unidad})
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Cantidad ingresada</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder="Ej: 24"
              min="0.01"
              step="0.01"
              value={form.cantidad}
              onChange={(e) =>
                setForm((f) => ({ ...f, cantidad: e.target.value }))
              }
            />
          </div>

          <div className="input-group">
            <label>Costo unitario de compra (Bs)</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder="Ej: 12.50"
              min="0.01"
              step="0.01"
              value={form.costoUnitario}
              onChange={(e) =>
                setForm((f) => ({ ...f, costoUnitario: e.target.value }))
              }
            />
          </div>

          {/* Vista previa del costo total */}
          {form.cantidad && form.costoUnitario && (
            <div
              style={{
                background: "var(--color-surface2)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span className="text-muted text-small">Total inversión</span>
              <span style={{ fontWeight: 600, color: "var(--color-warning)" }}>
                {formatBs(
                  parseFloat(form.cantidad || 0) *
                    parseFloat(form.costoUnitario || 0),
                )}
              </span>
            </div>
          )}

          <div className="input-group">
            <label>
              Proveedor <span className="text-muted">(opcional)</span>
            </label>
            <input
              className="input"
              type="text"
              placeholder="Ej: Distribuidora Norte"
              value={form.proveedor}
              onChange={(e) =>
                setForm((f) => ({ ...f, proveedor: e.target.value }))
              }
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button
            className="btn btn-primary btn-full"
            onClick={guardar}
            disabled={guardando}
            style={{ marginTop: "4px" }}
          >
            {guardando ? "Registrando..." : "Registrar entrada"}
          </button>
        </div>
      </div>
    );
  }

  // ── Vista historial ──────────────────────────────────────────────────────────
  if (vista === "historial") {
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
          <button onClick={() => setVista("stock")} className="btn btn-ghost" style={{ height: "34px", padding: "0 12px" }}>
            <ArrowLeft size={15} /> Volver
          </button>
          <h2>Historial de entradas</h2>
        </div>

        {historial.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              marginTop: "48px",
              color: "var(--color-text-2)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📋</div>
            <p style={{ fontSize: "0.9rem" }}>Sin entradas registradas.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {historial.map((lote) => (
              <div
                key={lote.id}
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
                      {lote.producto?.nombre ?? "Producto eliminado"}
                    </p>
                    <p
                      className="text-muted text-small"
                      style={{ marginTop: "2px" }}
                    >
                      {lote.proveedor} · {formatFecha(lote.fecha)}
                    </p>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      flexShrink: 0,
                      marginLeft: "12px",
                    }}
                  >
                    <p style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      {lote.cantidad} uds
                    </p>
                    <p className="text-muted text-small">
                      {formatBs(lote.costoUnitario)} / u
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid var(--color-border)",
                  }}
                >
                  <span className="text-muted text-small">
                    Restante: {lote.cantidadRestante} uds
                  </span>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--color-warning)",
                    }}
                  >
                    Total: {formatBs(lote.cantidad * lote.costoUnitario)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Vista principal: stock actual ────────────────────────────────────────────
  const stockFiltrado = stockData.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busqueda.toLowerCase()),
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
        <h2 style={{ fontSize: "1.1rem" }}>Stock actual</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-ghost" style={{ height: "36px", padding: "0 12px", fontSize: "0.875rem" }} onClick={() => setVista("historial")}>
            <History size={15} /> Historial
          </button>
          <button className="btn btn-primary" style={{ height: "36px", padding: "0 14px", fontSize: "0.875rem" }} onClick={() => abrirNuevo()}>
            <Plus size={16} /> Entrada
          </button>
        </div>
      </div>

      <input
        className="input"
        type="search"
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ marginBottom: "12px" }}
      />

      {stockFiltrado.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            marginTop: "48px",
            color: "var(--color-text-2)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🏪</div>
          <p style={{ fontSize: "0.9rem" }}>
            {busqueda
              ? "Sin resultados."
              : "Sin stock registrado. Agregá una entrada."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {stockFiltrado.map((p) => {
            const sinStock = p.stock.totalUnidades === 0;
            return (
              <div key={p.id} className="card" style={{ padding: "14px 16px" }}>
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
                        color: sinStock
                          ? "var(--color-text-2)"
                          : "var(--color-text)",
                      }}
                    >
                      {p.nombre}
                    </p>
                    <div
                      style={{ display: "flex", gap: "6px", marginTop: "4px" }}
                    >
                      <span className="badge badge-purple">{p.categoria}</span>
                      {sinStock && (
                        <span className="badge badge-red">Sin stock</span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      flexShrink: 0,
                      marginLeft: "12px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 600,
                        color: sinStock
                          ? "var(--color-danger)"
                          : "var(--color-success)",
                      }}
                    >
                      {p.stock.totalUnidades}
                    </p>
                    <p className="text-muted text-small">{p.unidad}s</p>
                  </div>
                </div>

                {!sinStock && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "10px",
                      paddingTop: "10px",
                      borderTop: "1px solid var(--color-border)",
                    }}
                  >
                    <span className="text-muted text-small">
                      Costo prom: {formatBs(p.stock.costoPromedio)}
                    </span>
                    <span className="text-muted text-small">
                      Inversión: {formatBs(p.stock.costoTotal)}
                    </span>
                  </div>
                )}

                <button
                  className="btn btn-ghost btn-full"
                  style={{
                    marginTop: "10px",
                    height: "32px",
                    fontSize: "0.8rem",
                  }}
                  onClick={() => abrirNuevo(p.id)}
                >
                  <Plus size={14} /> Agregar stock
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
