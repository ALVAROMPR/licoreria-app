import { useState, useEffect } from "react";
import { db } from "../db";

function formatBs(valor) {
  return `Bs ${Number(valor).toFixed(2)}`;
}

function formatFecha(str) {
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function TarjetaMetrica({ label, valor, color, subvalor, sublabel }) {
  return (
    <div
      style={{
        background: "var(--color-surface2)",
        borderRadius: "var(--radius-md)",
        padding: "14px",
      }}
    >
      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--color-text-2)",
          marginBottom: "6px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "1.15rem",
          fontWeight: 700,
          color: color ?? "var(--color-text)",
        }}
      >
        {valor}
      </p>
      {subvalor !== undefined && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-2)",
            marginTop: "3px",
          }}
        >
          {sublabel}: {subvalor}
        </p>
      )}
    </div>
  );
}

export default function Dashboard({ setPagina }) {
  const [sesionHoy, setSesionHoy] = useState(null);
  const [ventasHoy, setVentasHoy] = useState(0);
  const [stockBajo, setStockBajo] = useState([]);
  const [sinStock, setSinStock] = useState([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [ultimasVentas, setUltimasVentas] = useState([]);
  const [productos, setProductos] = useState({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const hoy = new Date().toISOString().split("T")[0];
      const prods = await db.productos.toArray();
      const prodMap = {};
      prods.forEach((p) => {
        prodMap[p.id] = p;
      });
      setProductos(prodMap);
      setTotalProductos(prods.length);

      // Sesión de hoy
      const sesiones = await db.sesiones_venta.toArray();
      const sesHoy = sesiones.find((s) => s.fecha === hoy) ?? null;
      setSesionHoy(sesHoy);

      // Cantidad de ventas hoy
      if (sesHoy) {
        const cnt = await db.ventas.where("sesionId").equals(sesHoy.id).count();
        setVentasHoy(cnt);
      }

      // Stock bajo y sin stock
      const lotes = await db.lotes.toArray();
      const stockPorProd = {};
      for (const l of lotes) {
        if (!stockPorProd[l.productoId]) stockPorProd[l.productoId] = 0;
        stockPorProd[l.productoId] += l.cantidadRestante;
      }

      const bajo = [];
      const cero = [];
      for (const p of prods) {
        const cant = stockPorProd[p.id] ?? 0;
        if (cant === 0) cero.push(p);
        else if (cant <= 5) bajo.push({ ...p, cantidad: cant });
      }
      setSinStock(cero);
      setStockBajo(bajo);

      // Últimas 5 ventas
      const ventas = await db.ventas
        .orderBy("fecha")
        .reverse()
        .limit(5)
        .toArray();
      setUltimasVentas(
        ventas.map((v) => ({ ...v, producto: prodMap[v.productoId] })),
      );
    } finally {
      setCargando(false);
    }
  }

  if (cargando) {
    return (
      <div
        style={{
          textAlign: "center",
          marginTop: "48px",
          color: "var(--color-text-2)",
          fontSize: "0.9rem",
        }}
      >
        Cargando...
      </div>
    );
  }

  const margen =
    sesionHoy?.totalVendido > 0
      ? ((sesionHoy.totalGanancia / sesionHoy.totalVendido) * 100).toFixed(1) +
        "%"
      : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ── Alertas de stock ── */}
      {(sinStock.length > 0 || stockBajo.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sinStock.length > 0 && (
            <div
              className="alert alert-danger"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                ⚠️ {sinStock.length} producto{sinStock.length !== 1 ? "s" : ""}{" "}
                sin stock
              </span>
              <button
                onClick={() => setPagina("stock")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fca5a5",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Ver
              </button>
            </div>
          )}
          {stockBajo.length > 0 && (
            <div
              className="alert"
              style={{
                background: "rgba(245,158,11,0.1)",
                color: "#fcd34d",
                border: "1px solid rgba(245,158,11,0.25)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                🔶 {stockBajo.length} producto
                {stockBajo.length !== 1 ? "s" : ""} con stock bajo (≤5)
              </span>
              <button
                onClick={() => setPagina("stock")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fcd34d",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Ver
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Resumen del día ── */}
      <div>
        <p
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--color-text-2)",
            marginBottom: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Hoy · {formatFecha(new Date().toISOString().split("T")[0])}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          <TarjetaMetrica
            label="Vendido"
            valor={formatBs(sesionHoy?.totalVendido ?? 0)}
            subvalor={ventasHoy}
            sublabel="ventas"
          />
          <TarjetaMetrica
            label="Ganancia"
            valor={formatBs(sesionHoy?.totalGanancia ?? 0)}
            color="var(--color-success)"
            subvalor={margen}
            sublabel="margen"
          />
          <TarjetaMetrica
            label="Capital recuperado"
            valor={formatBs(sesionHoy?.totalRecuperacion ?? 0)}
            color="var(--color-warning)"
          />
          <TarjetaMetrica
            label="Productos"
            valor={totalProductos}
            subvalor={sinStock.length > 0 ? sinStock.length : "todos"}
            sublabel={sinStock.length > 0 ? "sin stock" : "con stock"}
          />
        </div>
      </div>

      {/* ── Últimas ventas ── */}
      {ultimasVentas.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <p
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--color-text-2)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Últimas ventas
            </p>
            <button
              onClick={() => setPagina("ventas")}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-primary)",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Ver todas →
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {ultimasVentas.map((v) => (
              <div
                key={v.id}
                className="card"
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {v.producto?.nombre ?? "Producto eliminado"}
                  </p>
                  <p className="text-muted text-small">
                    {v.cantidad} u · {formatBs(v.precioVenta)}/u
                  </p>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    flexShrink: 0,
                    marginLeft: "12px",
                  }}
                >
                  <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    {formatBs(v.precioVenta * v.cantidad)}
                  </p>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-success)",
                    }}
                  >
                    +{formatBs(v.ganancia)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Accesos rápidos ── */}
      <div>
        <p
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--color-text-2)",
            marginBottom: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Acceso rápido
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          {[
            { label: "+ Nueva venta", icon: "🛒", pagina: "ventas" },
            { label: "+ Entrada stock", icon: "📦", pagina: "stock" },
            { label: "Ver reporte", icon: "📈", pagina: "reporte" },
            { label: "Productos", icon: "🗂️", pagina: "productos" },
          ].map((item) => (
            <button
              key={item.pagina}
              onClick={() => setPagina(item.pagina)}
              className="btn btn-ghost"
              style={{
                height: "52px",
                flexDirection: "column",
                gap: "4px",
                fontSize: "0.8rem",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
