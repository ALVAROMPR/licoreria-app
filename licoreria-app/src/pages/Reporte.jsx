import { useState, useEffect } from "react";
import { db } from "../db";
import { ArrowLeft, Download, ChevronRight } from "lucide-react";

function formatBs(valor) {
  return `Bs ${Number(valor).toFixed(2)}`;
}

function formatFecha(str) {
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function formatHora(ts) {
  return new Date(ts).toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PorcentajeBar({ valor, total, color }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div
      style={{
        height: "6px",
        background: "var(--color-surface2)",
        borderRadius: "999px",
        overflow: "hidden",
        marginTop: "6px",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: "999px",
          transition: "width 0.4s",
        }}
      />
    </div>
  );
}

export default function Reporte() {
  const [sesiones, setSesiones] = useState([]);
  const [sesionSel, setSesionSel] = useState(null);
  const [ventasSel, setVentasSel] = useState([]);
  const [productos, setProductos] = useState({});
  const [vista, setVista] = useState("resumen"); // 'resumen' | 'detalle'
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const sess = await db.sesiones_venta.orderBy("fecha").reverse().toArray();
    setSesiones(sess);

    const prods = await db.productos.toArray();
    const mapa = {};
    prods.forEach((p) => {
      mapa[p.id] = p;
    });
    setProductos(mapa);

    // Pasar mapa directamente — no depender del estado que aún no actualizó
    if (sess.length > 0) {
      await seleccionarSesion(sess[0], mapa);
    }
  }

  async function seleccionarSesion(sesion, prodMap) {
    setSesionSel(sesion);
    const ventas = await db.ventas
      .where("sesionId")
      .equals(sesion.id)
      .sortBy("fecha");

    const map = prodMap || productos;
    setVentasSel(ventas.map((v) => ({ ...v, producto: map[v.productoId] })));
    setVista("resumen");
  }

  // ── Exportar a JSON ──────────────────────────────────────────────────────────
  async function exportarJSON() {
    setExportando(true);
    try {
      const todasVentas = await db.ventas.toArray();
      const todosLotes = await db.lotes.toArray();
      const todosProds = await db.productos.toArray();
      const todasSesiones = await db.sesiones_venta.toArray();

      const datos = {
        exportado: new Date().toISOString(),
        productos: todosProds,
        lotes: todosLotes,
        ventas: todasVentas,
        sesiones: todasSesiones,
      };

      const blob = new Blob([JSON.stringify(datos, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `licoreria_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  // ── Exportar a CSV ───────────────────────────────────────────────────────────
  async function exportarCSV() {
    setExportando(true);
    try {
      const ventas = await db.ventas.toArray();
      const prods = await db.productos.toArray();
      const sess = await db.sesiones_venta.toArray();

      const prodMap = {};
      prods.forEach((p) => {
        prodMap[p.id] = p;
      });

      const sessMap = {};
      sess.forEach((s) => {
        sessMap[s.id] = s;
      });

      const filas = [
        [
          "Fecha",
          "Hora",
          "Producto",
          "Cantidad",
          "Precio Venta (Bs)",
          "Costo Unitario (Bs)",
          "Total Venta (Bs)",
          "Recuperacion (Bs)",
          "Ganancia (Bs)",
        ],
        ...ventas.map((v) => {
          const d = new Date(v.fecha);
          const sess = sessMap[v.sesionId];
          return [
            sess?.fecha ?? "",
            d.toLocaleTimeString("es-BO", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            prodMap[v.productoId]?.nombre ?? "N/A",
            v.cantidad,

            v.precioVenta.toFixed(2).replace(".", ","),
            v.costoPromedio.toFixed(2).replace(".", ","),
            (v.precioVenta * v.cantidad).toFixed(2).replace(".", ","),
            v.recuperacion.toFixed(2).replace(".", ","),
            v.ganancia.toFixed(2).replace(".", ","),
          ];
        }),
      ];

      const csv = filas.map((f) => f.join(";")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `licoreria_ventas_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  // ── Detalle de ventas de una sesión ─────────────────────────────────────────
  if (vista === "detalle" && sesionSel) {
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
          <button onClick={() => setVista("resumen")} className="btn btn-ghost" style={{ height: "34px", padding: "0 12px" }}>
            <ArrowLeft size={15} /> Volver
          </button>
          <h2 style={{ fontSize: "1.1rem" }}>
            Detalle · {formatFecha(sesionSel.fecha)}
          </h2>
        </div>

        {ventasSel.length === 0 ? (
          <p
            className="text-muted text-small"
            style={{ textAlign: "center", marginTop: "32px" }}
          >
            Sin ventas registradas este día.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {ventasSel.map((v) => (
              <div key={v.id} className="card" style={{ padding: "12px 14px" }}>
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
                        fontSize: "0.875rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.producto?.nombre ?? "Producto eliminado"}
                    </p>
                    <p className="text-muted text-small">
                      {v.cantidad} u · {formatHora(v.fecha)}
                    </p>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      flexShrink: 0,
                      marginLeft: "12px",
                    }}
                  >
                    <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                      {formatBs(v.precioVenta * v.cantidad)}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color:
                          v.ganancia >= 0
                            ? "var(--color-success)"
                            : "var(--color-danger)",
                      }}
                    >
                      +{formatBs(v.ganancia)}
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "8px",
                    paddingTop: "8px",
                    borderTop: "1px solid var(--color-border)",
                    fontSize: "0.75rem",
                  }}
                >
                  <span className="text-muted">
                    Venta: {formatBs(v.precioVenta)}/u
                  </span>
                  <span className="text-muted">
                    Costo: {formatBs(v.costoPromedio)}/u
                  </span>
                  <span className="text-muted">
                    Recup: {formatBs(v.recuperacion)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Vista principal: resumen ─────────────────────────────────────────────────
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
        <h2 style={{ fontSize: "1.1rem" }}>Reporte</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-ghost" style={{ height: "34px", padding: "0 12px", fontSize: "0.8rem" }} onClick={exportarCSV} disabled={exportando}>
            <Download size={14} /> CSV
          </button>
          <button className="btn btn-ghost" style={{ height: "34px", padding: "0 12px", fontSize: "0.8rem" }} onClick={exportarJSON} disabled={exportando}>
            <Download size={14} /> JSON
          </button>
        </div>
      </div>

      {/* Sesión seleccionada — resumen */}
      {sesionSel && (
        <div className="card" style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <div>
              <p style={{ fontWeight: 600, fontSize: "1rem" }}>
                {formatFecha(sesionSel.fecha)}
              </p>
              <p className="text-muted text-small">
                {ventasSel.length} venta{ventasSel.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              className="btn btn-ghost"
              style={{ height: "32px", padding: "0 12px", fontSize: "0.8rem" }}
              onClick={() => setVista("detalle")}
            >
              Ver detalle
            </button>
          </div>

          {/* Barra de desglose */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.875rem",
                }}
              >
                <span className="text-muted">Total vendido</span>
                <span style={{ fontWeight: 600 }}>
                  {formatBs(sesionSel.totalVendido)}
                </span>
              </div>
              <PorcentajeBar
                valor={sesionSel.totalVendido}
                total={sesionSel.totalVendido}
                color="var(--color-primary)"
              />
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.875rem",
                }}
              >
                <span className="text-muted">Recuperación de capital</span>
                <span
                  style={{ fontWeight: 600, color: "var(--color-warning)" }}
                >
                  {formatBs(sesionSel.totalRecuperacion)}
                </span>
              </div>
              <PorcentajeBar
                valor={sesionSel.totalRecuperacion}
                total={sesionSel.totalVendido}
                color="var(--color-warning)"
              />
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.875rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>Ganancia neta</span>
                <span
                  style={{ fontWeight: 700, color: "var(--color-success)" }}
                >
                  {formatBs(sesionSel.totalGanancia)}
                </span>
              </div>
              <PorcentajeBar
                valor={sesionSel.totalGanancia}
                total={sesionSel.totalVendido}
                color="var(--color-success)"
              />
            </div>
          </div>

          {/* Margen */}
          {sesionSel.totalVendido > 0 && (
            <div
              style={{
                marginTop: "14px",
                paddingTop: "14px",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span className="text-muted text-small">Margen del día</span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  color: "var(--color-success)",
                }}
              >
                {(
                  (sesionSel.totalGanancia / sesionSel.totalVendido) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          )}
        </div>
      )}

      {/* Historial de días anteriores */}
      {sesiones.length > 1 && (
        <>
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
            Historial
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {sesiones.slice(1).map((s) => (
              <button
                key={s.id}
                onClick={() => seleccionarSesion(s)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background:
                    sesionSel?.id === s.id
                      ? "var(--color-surface2)"
                      : "var(--color-surface)",
                  border: `1px solid ${sesionSel?.id === s.id ? "var(--color-primary)" : "var(--color-border)"}`,
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                }}
              >
                <div>
                  <p
                    style={{
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      color: "var(--color-text)",
                    }}
                  >
                    {formatFecha(s.fecha)}
                  </p>
                  <p className="text-muted text-small">
                    {formatBs(s.totalVendido)} vendido
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--color-success)",
                    }}
                  >
                    {formatBs(s.totalGanancia)}
                  </p>
                  <p className="text-muted text-small">
                    {s.totalVendido > 0
                      ? ((s.totalGanancia / s.totalVendido) * 100).toFixed(1) +
                        "%"
                      : "—"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {sesiones.length === 0 && (
        <div
          style={{
            textAlign: "center",
            marginTop: "48px",
            color: "var(--color-text-2)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📈</div>
          <p style={{ fontSize: "0.9rem" }}>
            Sin datos todavía. Registrá ventas para ver el reporte.
          </p>
        </div>
      )}
    </div>
  );
}
