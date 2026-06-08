import { useState, useEffect } from "react";
import { db, getSesionAbierta, abrirCaja, cerrarCaja } from "../db";
import {
  DollarSign, TrendingUp, RefreshCw, Package,
  AlertTriangle, AlertCircle, ShoppingCart,
  ChevronRight, ChevronDown, Warehouse, BarChart3,
  LockOpen, Lock,
} from "lucide-react";

function formatBs(valor) {
  return `Bs ${Number(valor).toFixed(2)}`;
}
function formatFecha(str) {
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}
function formatHora(ts) {
  return new Date(ts).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

function StatCard({ label, valor, color, subvalor, sublabel, Icon, iconBg }) {
  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <div className="stat-card__icon" style={{ background: iconBg }}>
          <Icon size={15} color={color} strokeWidth={2.2} />
        </div>
      </div>
      <p className="stat-card__value" style={{ color: color ?? "var(--color-text)" }}>
        {valor}
      </p>
      {subvalor !== undefined && (
        <p className="stat-card__sub">
          {sublabel}: <span style={{ color: "var(--color-text)", fontWeight: 500 }}>{subvalor}</span>
        </p>
      )}
    </div>
  );
}

const ACCESOS = [
  { label: "Nueva venta",   Icon: ShoppingCart, pagina: "ventas",    color: "var(--color-primary)" },
  { label: "Entrada stock", Icon: Warehouse,    pagina: "stock",     color: "var(--color-success)" },
  { label: "Reporte",       Icon: BarChart3,    pagina: "reporte",   color: "var(--color-warning)" },
  { label: "Productos",     Icon: Package,      pagina: "productos", color: "var(--color-text-2)"  },
];

export default function Dashboard({ setPagina }) {
  const [sesion, setSesion]                 = useState(null); // sesión actualmente abierta
  const [sesionDisplay, setSesionDisplay]   = useState(null); // para mostrar stats
  const [ventasSesion, setVentasSesion]     = useState(0);
  const [stockBajo, setStockBajo]           = useState([]);
  const [sinStock, setSinStock]             = useState([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [ultimasVentas, setUltimasVentas]   = useState([]);
  const [cargando, setCargando]             = useState(true); // true desde el inicio, sin llamada síncrona en effect
  const [accionCaja, setAccionCaja]         = useState(false);
  const [mostrarSinStock, setMostrarSinStock]   = useState(false);
  const [mostrarStockBajo, setMostrarStockBajo] = useState(false);

  async function cargarDatos() {
    try {
      const prods = await db.productos.toArray();
      const prodMap = {};
      prods.forEach(p => { prodMap[p.id] = p; });
      setTotalProductos(prods.length);

      const sesionActual = await getSesionAbierta();
      setSesion(sesionActual);

      // Para métricas: sesión abierta o la más reciente si está cerrada
      const display = sesionActual
        ?? (await db.sesiones_venta.orderBy("id").last())
        ?? null;
      setSesionDisplay(display);

      if (display) {
        const cnt = await db.ventas.where("sesionId").equals(display.id).count();
        setVentasSesion(cnt);
        const ventas = await db.ventas.where("sesionId").equals(display.id).sortBy("fecha");
        setUltimasVentas(
          ventas.slice(-5).reverse().map(v => ({ ...v, producto: prodMap[v.productoId] }))
        );
      } else {
        setVentasSesion(0);
        setUltimasVentas([]);
      }

      const lotes = await db.lotes.toArray();
      const stockPorProd = {};
      for (const l of lotes) {
        if (!stockPorProd[l.productoId]) stockPorProd[l.productoId] = 0;
        stockPorProd[l.productoId] += l.cantidadRestante;
      }

      const bajo = [], cero = [];
      for (const p of prods) {
        const cant = stockPorProd[p.id] ?? 0;
        if (cant === 0) cero.push(p);
        else if (cant <= 5) bajo.push({ ...p, cantidad: cant });
      }
      setSinStock(cero);
      setStockBajo(bajo);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarDatos(); }, []);

  async function handleAbrirCaja() {
    setAccionCaja(true);
    try {
      await abrirCaja();
      await cargarDatos();
    } finally {
      setAccionCaja(false);
    }
  }

  async function handleCerrarCaja() {
    if (!sesion) return;
    const ok = window.confirm(
      "¿Cerrar la caja?\n\nNo se podrán registrar ventas hasta que la abras nuevamente."
    );
    if (!ok) return;
    setAccionCaja(true);
    try {
      await cerrarCaja(sesion.id);
      await cargarDatos();
    } finally {
      setAccionCaja(false);
    }
  }

  if (cargando) {
    return (
      <div style={{ textAlign: "center", marginTop: "60px", color: "var(--color-text-2)", fontSize: "0.875rem" }}>
        Cargando...
      </div>
    );
  }

  const cajaAbierta = sesion !== null;
  const margen = sesionDisplay?.totalVendido > 0
    ? ((sesionDisplay.totalGanancia / sesionDisplay.totalVendido) * 100).toFixed(1) + "%"
    : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* ── Estado de caja ── */}
      <div style={{
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${cajaAbierta ? "rgba(34,197,94,0.3)" : "var(--color-border)"}`,
        background: cajaAbierta ? "rgba(34,197,94,0.06)" : "var(--color-surface)",
        padding: "16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
            background: cajaAbierta ? "rgba(34,197,94,0.15)" : "var(--color-surface2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {cajaAbierta
              ? <LockOpen size={20} color="var(--color-success)" />
              : <Lock     size={20} color="var(--color-text-2)"  />
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: "0.95rem", color: cajaAbierta ? "var(--color-success)" : "var(--color-text)" }}>
              {cajaAbierta ? "Caja abierta" : "Caja cerrada"}
            </p>
            <p className="text-muted text-small">
              {cajaAbierta && sesion?.fechaApertura
                ? `Desde las ${formatHora(sesion.fechaApertura)}`
                : sesionDisplay?.fechaCierre
                ? `Cerró a las ${formatHora(sesionDisplay.fechaCierre)}`
                : "Sin sesiones previas"
              }
            </p>
          </div>
        </div>
        <button
          className={cajaAbierta ? "btn btn-ghost" : "btn btn-primary"}
          style={{ height: "36px", padding: "0 14px", fontSize: "0.825rem", flexShrink: 0 }}
          onClick={cajaAbierta ? handleCerrarCaja : handleAbrirCaja}
          disabled={accionCaja}
        >
          {accionCaja ? "…" : cajaAbierta ? "Cerrar caja" : "Abrir caja"}
        </button>
      </div>

      {/* ── Alertas ── */}
      {(sinStock.length > 0 || stockBajo.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

          {sinStock.length > 0 && (
            <div>
              <button
                className="alert alert-danger"
                onClick={() => setMostrarSinStock(v => !v)}
                style={{
                  width: "100%", justifyContent: "space-between", cursor: "pointer",
                  borderRadius: mostrarSinStock
                    ? "var(--radius-md) var(--radius-md) 0 0"
                    : "var(--radius-md)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertTriangle size={16} />
                  <span>{sinStock.length} producto{sinStock.length !== 1 ? "s" : ""} sin stock</span>
                </div>
                {mostrarSinStock ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              {mostrarSinStock && (
                <div style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderTop: "none",
                  borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                  padding: "6px 14px",
                  display: "flex",
                  flexDirection: "column",
                }}>
                  {sinStock.map((p, i) => (
                    <div key={p.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0",
                      borderBottom: i < sinStock.length - 1 ? "1px solid rgba(239,68,68,0.1)" : "none",
                    }}>
                      <span style={{ fontSize: "0.85rem" }}>{p.nombre}</span>
                      <span className="badge badge-red">Sin stock</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {stockBajo.length > 0 && (
            <div>
              <button
                className="alert alert-warning"
                onClick={() => setMostrarStockBajo(v => !v)}
                style={{
                  width: "100%", justifyContent: "space-between", cursor: "pointer",
                  borderRadius: mostrarStockBajo
                    ? "var(--radius-md) var(--radius-md) 0 0"
                    : "var(--radius-md)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertCircle size={16} />
                  <span>{stockBajo.length} producto{stockBajo.length !== 1 ? "s" : ""} con stock bajo (≤5)</span>
                </div>
                {mostrarStockBajo ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              {mostrarStockBajo && (
                <div style={{
                  background: "rgba(251,191,36,0.06)",
                  border: "1px solid rgba(251,191,36,0.25)",
                  borderTop: "none",
                  borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                  padding: "6px 14px",
                  display: "flex",
                  flexDirection: "column",
                }}>
                  {stockBajo.map((p, i) => (
                    <div key={p.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0",
                      borderBottom: i < stockBajo.length - 1 ? "1px solid rgba(251,191,36,0.1)" : "none",
                    }}>
                      <span style={{ fontSize: "0.85rem" }}>{p.nombre}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-warning)" }}>{p.cantidad} u</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── Métricas de la sesión ── */}
      <div>
        <p className="section-label">
          {cajaAbierta && sesion?.fechaApertura
            ? `Sesión · desde ${formatHora(sesion.fechaApertura)}`
            : sesionDisplay
            ? `Última sesión · ${formatFecha(sesionDisplay.fecha)}`
            : "Sin sesiones"
          }
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <StatCard
            label="Vendido" valor={formatBs(sesionDisplay?.totalVendido ?? 0)}
            Icon={DollarSign} iconBg="var(--color-primary-dim)" color="var(--color-primary)"
            subvalor={ventasSesion} sublabel="ventas"
          />
          <StatCard
            label="Ganancia" valor={formatBs(sesionDisplay?.totalGanancia ?? 0)}
            Icon={TrendingUp} iconBg="var(--color-success-dim)" color="var(--color-success)"
            subvalor={margen} sublabel="margen"
          />
          <StatCard
            label="Capital" valor={formatBs(sesionDisplay?.totalRecuperacion ?? 0)}
            Icon={RefreshCw} iconBg="var(--color-warning-dim)" color="var(--color-warning)"
          />
          <StatCard
            label="Productos" valor={totalProductos}
            Icon={Package} iconBg="rgba(255,255,255,0.05)" color="var(--color-text-2)"
            subvalor={sinStock.length > 0 ? sinStock.length : "todos"}
            sublabel={sinStock.length > 0 ? "sin stock" : "en stock"}
          />
        </div>
      </div>

      {/* ── Últimas ventas ── */}
      {ultimasVentas.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <p className="section-label" style={{ marginBottom: 0 }}>
              {cajaAbierta ? "Ventas de la sesión" : "Ventas de la última sesión"}
            </p>
            <button
              onClick={() => setPagina("ventas")}
              style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px" }}
            >
              Ver todas <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {ultimasVentas.map(v => (
              <div key={v.id} className="list-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.producto?.nombre ?? "Producto eliminado"}
                  </p>
                  <p className="text-muted text-small" style={{ marginTop: "2px" }}>
                    {v.cantidad} u · {formatHora(v.fecha)}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "14px" }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>{formatBs(v.precioVenta * v.cantidad)}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--color-success)", marginTop: "2px" }}>+{formatBs(v.ganancia)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Acceso rápido ── */}
      <div>
        <p className="section-label">Acceso rápido</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {ACCESOS.map(({ label, Icon, pagina, color }) => (
            <button
              key={pagina}
              onClick={() => setPagina(pagina)}
              className="btn btn-ghost"
              style={{ height: "56px", flexDirection: "column", gap: "5px", fontSize: "0.78rem" }}
            >
              <Icon size={19} color={color} strokeWidth={1.9} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
