import { useState, useEffect } from "react";
import { db } from "../db";
import {
  DollarSign, TrendingUp, RefreshCw, Package,
  AlertTriangle, AlertCircle, ShoppingCart,
  ChevronRight, Plus, Warehouse, BarChart3,
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
  const [sesionHoy, setSesionHoy]       = useState(null);
  const [ventasHoy, setVentasHoy]       = useState(0);
  const [stockBajo, setStockBajo]       = useState([]);
  const [sinStock, setSinStock]         = useState([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [ultimasVentas, setUltimasVentas]   = useState([]);
  const [cargando, setCargando]         = useState(true);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const hoy = new Date().toLocaleDateString("en-CA");
      const prods = await db.productos.toArray();
      const prodMap = {};
      prods.forEach(p => { prodMap[p.id] = p; });
      setTotalProductos(prods.length);

      const sesiones = await db.sesiones_venta.toArray();
      const sesHoy = sesiones.find(s => s.fecha === hoy) ?? null;
      setSesionHoy(sesHoy);

      if (sesHoy) {
        const cnt = await db.ventas.where("sesionId").equals(sesHoy.id).count();
        setVentasHoy(cnt);
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

      const ventas = await db.ventas.orderBy("fecha").reverse().limit(5).toArray();
      setUltimasVentas(ventas.map(v => ({ ...v, producto: prodMap[v.productoId] })));
    } finally {
      setCargando(false);
    }
  }

  if (cargando) {
    return (
      <div style={{ textAlign: "center", marginTop: "60px", color: "var(--color-text-2)", fontSize: "0.875rem" }}>
        Cargando...
      </div>
    );
  }

  const margen = sesionHoy?.totalVendido > 0
    ? ((sesionHoy.totalGanancia / sesionHoy.totalVendido) * 100).toFixed(1) + "%"
    : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* ── Alertas ── */}
      {(sinStock.length > 0 || stockBajo.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sinStock.length > 0 && (
            <div className="alert alert-danger" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={16} />
                <span>{sinStock.length} producto{sinStock.length !== 1 ? "s" : ""} sin stock</span>
              </div>
              <button
                onClick={() => setPagina("stock")}
                style={{ background: "none", border: "none", color: "#fca5a5", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}
              >
                Ver <ChevronRight size={14} />
              </button>
            </div>
          )}
          {stockBajo.length > 0 && (
            <div className="alert alert-warning" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertCircle size={16} />
                <span>{stockBajo.length} producto{stockBajo.length !== 1 ? "s" : ""} con stock bajo (≤5)</span>
              </div>
              <button
                onClick={() => setPagina("stock")}
                style={{ background: "none", border: "none", color: "#fcd34d", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}
              >
                Ver <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Métricas del día ── */}
      <div>
        <p className="section-label">
          Hoy · {formatFecha(new Date().toLocaleDateString("en-CA"))}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <StatCard
            label="Vendido" valor={formatBs(sesionHoy?.totalVendido ?? 0)}
            Icon={DollarSign} iconBg="var(--color-primary-dim)" color="var(--color-primary)"
            subvalor={ventasHoy} sublabel="ventas"
          />
          <StatCard
            label="Ganancia" valor={formatBs(sesionHoy?.totalGanancia ?? 0)}
            Icon={TrendingUp} iconBg="var(--color-success-dim)" color="var(--color-success)"
            subvalor={margen} sublabel="margen"
          />
          <StatCard
            label="Capital" valor={formatBs(sesionHoy?.totalRecuperacion ?? 0)}
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
            <p className="section-label" style={{ marginBottom: 0 }}>Últimas ventas</p>
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
