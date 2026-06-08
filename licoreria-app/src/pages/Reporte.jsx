import { useState, useEffect } from "react";
import { db, calcularCostoFIFO, descontarStock, actualizarTotalesSesion, eliminarVenta } from "../db";
import { ArrowLeft, Download, Pencil, Trash2, Printer } from "lucide-react";

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

function formatPeriodo(s) {
  if (!s.fechaApertura) return formatFecha(s.fecha);
  const ap = new Date(s.fechaApertura);
  const fechaStr = `${ap.getDate().toString().padStart(2,"0")}/${(ap.getMonth()+1).toString().padStart(2,"0")}/${ap.getFullYear()}`;
  const horaAp = ap.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
  if (s.fechaCierre) {
    const horaCi = new Date(s.fechaCierre).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
    return `${fechaStr}  ·  ${horaAp} – ${horaCi}`;
  }
  return `${fechaStr}  ·  ${horaAp} – ahora`;
}

function esc(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function PorcentajeBar({ valor, total, color }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div style={{ height: "6px", background: "var(--color-surface2)", borderRadius: "999px", overflow: "hidden", marginTop: "6px" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "999px", transition: "width 0.4s" }} />
    </div>
  );
}

const FORM_EDITAR_VACIO = { productoId: "", cantidad: "", precioVenta: "", costoUnitario: "" };

export default function Reporte() {
  const [sesiones, setSesiones]   = useState([]);
  const [sesionSel, setSesionSel] = useState(null);
  const [ventasSel, setVentasSel] = useState([]);
  const [productos, setProductos] = useState({});
  const [vista, setVista]         = useState("resumen");
  const [exportando, setExportando] = useState(false);

  const [ventaEditandoR, setVentaEditandoR]   = useState(null);
  const [formEditar, setFormEditar]           = useState(FORM_EDITAR_VACIO);
  const [errorEditar, setErrorEditar]         = useState("");
  const [guardandoEditar, setGuardandoEditar] = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const sess = await db.sesiones_venta.orderBy("id").reverse().toArray();
    setSesiones(sess);
    const prods = await db.productos.toArray();
    const mapa = {};
    prods.forEach((p) => { mapa[p.id] = p; });
    setProductos(mapa);
    if (sess.length > 0) await seleccionarSesion(sess[0], mapa);
  }

  async function seleccionarSesion(sesion, prodMap) {
    setSesionSel(sesion);
    const ventas = await db.ventas.where("sesionId").equals(sesion.id).sortBy("fecha");
    const map = prodMap || productos;
    setVentasSel(ventas.map((v) => ({ ...v, producto: map[v.productoId] })));
    setVista("resumen");
  }

  async function recargarSesion(sesionId) {
    const sess = await db.sesiones_venta.orderBy("id").reverse().toArray();
    setSesiones(sess);
    const sesionActualizada = sess.find((s) => s.id === sesionId) ?? sesionSel;
    if (sesionActualizada) {
      setSesionSel(sesionActualizada);
      const ventas = await db.ventas.where("sesionId").equals(sesionActualizada.id).sortBy("fecha");
      setVentasSel(ventas.map((v) => ({ ...v, producto: productos[v.productoId] })));
    }
  }

  // ── Imprimir reporte térmico ─────────────────────────────────────────────────
  function imprimirReporte() {
    if (!sesionSel) return;

    const periodo = formatPeriodo(sesionSel);
    const ahora = new Date().toLocaleString("es-BO", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const margen = sesionSel.totalVendido > 0
      ? ((sesionSel.totalGanancia / sesionSel.totalVendido) * 100).toFixed(1) + "%"
      : "—";

    const itemsHtml = ventasSel.length === 0
      ? `<p class="meta" style="text-align:center;padding:8px 0;color:#555">Sin ventas registradas.</p>`
      : ventasSel.map((v) => {
          const nombre     = esc(v.producto?.nombre ?? "Producto eliminado");
          const hora       = formatHora(v.fecha);
          const totalVenta = v.precioVenta * v.cantidad;
          return `
<div class="item">
  <div class="item-nombre">${nombre}</div>
  <div class="item-row">
    <span>${v.cantidad} u &nbsp;·&nbsp; ${hora}</span>
  </div>
  <div class="item-row">
    <span>Precio compra: <b>Bs ${v.costoPromedio.toFixed(2)}/u</b></span>
    <span>Precio venta: <b>Bs ${v.precioVenta.toFixed(2)}/u</b></span>
  </div>
  <div class="item-row item-totales">
    <span>Total vendido: <b>Bs ${totalVenta.toFixed(2)}</b></span>
    <span>Ganancia: <b>Bs ${v.ganancia.toFixed(2)}</b></span>
  </div>
</div>`;
        }).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Turno</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #000;
    background: #fff;
    padding: 10px 8px;
    max-width: 400px;
    margin: 0 auto;
  }
  @media print {
    @page { size: 80mm auto; margin: 3mm 2mm; }
    body  { max-width: none; margin: 0; padding: 2px 0; }
    .no-print { display: none !important; }
  }
  .center { text-align: center; }
  h1 { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  h2 { font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: center; margin: 4px 0 2px; }
  .meta { font-size: 10px; margin: 1px 0; }
  hr.d { border: none; border-top: 1px dashed #000; margin: 5px 0; }
  hr.s { border: none; border-top: 1px solid  #000; margin: 5px 0; }
  .item { padding: 5px 0; border-bottom: 1px dashed #aaa; }
  .item:last-child { border-bottom: none; }
  .item-nombre { font-weight: bold; font-size: 11px; margin-bottom: 3px; }
  .item-row    { display: flex; justify-content: space-between; font-size: 10px; margin-top: 1px; }
  .item-totales { margin-top: 3px; padding-top: 2px; border-top: 1px dotted #ccc; }
  .res-row   { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
  .res-total { font-weight: bold; font-size: 13px; padding-top: 4px; }
  .res-dim   { font-size: 10px; color: #444; }
  .footer    { text-align: center; font-size: 9px; color: #555; margin-top: 6px; padding-top: 4px; }
  .btn-imp   { display: block; width: 100%; margin-top: 14px; padding: 10px; font-size: 14px; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 4px; }
</style>
</head>
<body>

<div class="center">
  <h1>Catering Services Sil&amp;Te</h1>
  <p class="meta">Gesti&oacute;n de Ventas &middot; Licorer&iacute;a</p>
</div>

<hr class="s">

<p class="meta"><b>Per&iacute;odo:</b> ${esc(periodo)}</p>
<p class="meta"><b>Impresi&oacute;n:</b> ${ahora}</p>
<p class="meta"><b>Ventas:</b> ${ventasSel.length}</p>

<hr class="s">
<h2>Detalle de Ventas</h2>
<hr class="d">

${itemsHtml}

<hr class="s" style="margin-top:8px">
<h2>Resumen del Turno</h2>
<hr class="d">

<div class="res-row"><span>Total vendido:</span><span><b>Bs ${sesionSel.totalVendido.toFixed(2)}</b></span></div>
<div class="res-row"><span>Recuperaci&oacute;n capital:</span><span>Bs ${sesionSel.totalRecuperacion.toFixed(2)}</span></div>
<hr class="d">
<div class="res-row res-total"><span>GANANCIA NETA:</span><span>Bs ${sesionSel.totalGanancia.toFixed(2)}</span></div>
${sesionSel.totalVendido > 0 ? `<div class="res-row res-dim"><span>Margen del turno:</span><span>${margen}</span></div>` : ""}

<hr class="s">
<div class="footer">
  Catering Services Sil&amp;Te<br>
  Sistema de Gesti&oacute;n de Ventas
</div>

<button class="btn-imp no-print" onclick="window.print()">&#128424; Imprimir</button>

</body>
</html>`;

    try {
      const win = window.open("", "_blank", "width=440,height=700,scrollbars=yes");
      if (!win) {
        alert("Permitir ventanas emergentes en el navegador para imprimir.");
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
    } catch {
      alert("Error al abrir la vista de impresión.");
    }
  }

  // ── Eliminar venta desde Reporte ─────────────────────────────────────────────
  async function handleEliminarDeReporte(venta) {
    if (!window.confirm(`¿Eliminar la venta de "${venta.producto?.nombre ?? "este producto"}"?`)) return;
    try {
      await eliminarVenta(venta.id);
      await recargarSesion(venta.sesionId);
    } catch {
      alert("Error al eliminar la venta.");
    }
  }

  function abrirEditarReporte(venta) {
    setVentaEditandoR(venta);
    setFormEditar({
      productoId:    String(venta.productoId),
      cantidad:      String(venta.cantidad),
      precioVenta:   String(venta.precioVenta),
      costoUnitario: String(venta.costoPromedio),
    });
    setErrorEditar("");
    setVista("editar-venta");
  }

  async function guardarEdicionReporte() {
    if (!formEditar.productoId) { setErrorEditar("Seleccioná un producto."); return; }
    const cantidad      = parseFloat(formEditar.cantidad);
    const precioVenta   = parseFloat(formEditar.precioVenta);
    const costoUnitario = parseFloat(formEditar.costoUnitario);
    if (!cantidad || cantidad <= 0)                    { setErrorEditar("La cantidad debe ser mayor a 0."); return; }
    if (!precioVenta || precioVenta <= 0)              { setErrorEditar("El precio de venta debe ser mayor a 0."); return; }
    if (isNaN(costoUnitario) || costoUnitario < 0)     { setErrorEditar("El costo no es válido."); return; }

    setGuardandoEditar(true);
    setErrorEditar("");
    try {
      await eliminarVenta(ventaEditandoR.id);

      const resultado = await calcularCostoFIFO(parseInt(formEditar.productoId), cantidad);
      if (!resultado) {
        setErrorEditar("Stock insuficiente. La venta original fue anulada — registrala con los valores correctos.");
        await recargarSesion(ventaEditandoR.sesionId);
        setVentaEditandoR(null);
        setVista("detalle");
        return;
      }

      const ganancia    = (precioVenta - costoUnitario) * cantidad;
      const recuperacion = costoUnitario * cantidad;

      await db.ventas.add({
        productoId:    parseInt(formEditar.productoId),
        sesionId:      ventaEditandoR.sesionId,
        cantidad, precioVenta,
        costoPromedio: costoUnitario,
        ganancia, recuperacion,
        fecha:         Date.now(),
      });

      await descontarStock(resultado.lotesAfectados);
      await actualizarTotalesSesion(ventaEditandoR.sesionId, precioVenta, costoUnitario, cantidad);
      await recargarSesion(ventaEditandoR.sesionId);
      setVentaEditandoR(null);
      setVista("detalle");
    } catch {
      setErrorEditar("Error al editar. Intentá de nuevo.");
    } finally {
      setGuardandoEditar(false);
    }
  }

  // ── Exportar a CSV ───────────────────────────────────────────────────────────
  async function exportarCSV() {
    setExportando(true);
    try {
      const ventas  = await db.ventas.toArray();
      const prods   = await db.productos.toArray();
      const sess    = await db.sesiones_venta.toArray();
      const prodMap = {};
      prods.forEach((p) => { prodMap[p.id] = p; });
      const sessMap = {};
      sess.forEach((s) => { sessMap[s.id] = s; });

      const filas = [
        ["Fecha","Hora","Producto","Cantidad","Precio Venta (Bs)","Costo Unitario (Bs)","Total Venta (Bs)","Recuperacion (Bs)","Ganancia (Bs)"],
        ...ventas.map((v) => {
          const d = new Date(v.fecha);
          return [
            sessMap[v.sesionId]?.fecha ?? "",
            d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }),
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

      const csv  = filas.map((f) => f.join(";")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `licoreria_ventas_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  // ── Vista: formulario de edición ─────────────────────────────────────────────
  if (vista === "editar-venta" && ventaEditandoR) {
    const productosArr = Object.values(productos).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const p = parseFloat(formEditar.precioVenta) || 0;
    const c = parseFloat(formEditar.costoUnitario) || 0;
    const q = parseFloat(formEditar.cantidad) || 0;
    const hayPreview = q > 0 && p > 0;

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <button onClick={() => { setVista("detalle"); setVentaEditandoR(null); setErrorEditar(""); }} className="btn btn-ghost" style={{ height: "34px", padding: "0 12px" }}>
            <ArrowLeft size={15} /> Volver
          </button>
          <h2>Editar venta</h2>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="input-group">
            <label>Producto</label>
            <select className="input" value={formEditar.productoId} onChange={(e) => setFormEditar((f) => ({ ...f, productoId: e.target.value }))}>
              <option value="">— Seleccioná un producto —</option>
              {productosArr.map((pr) => (<option key={pr.id} value={pr.id}>{pr.nombre}</option>))}
            </select>
          </div>
          <div className="input-group">
            <label>Cantidad</label>
            <input className="input" type="number" inputMode="decimal" min="0.01" step="0.01" value={formEditar.cantidad} onChange={(e) => setFormEditar((f) => ({ ...f, cantidad: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Precio de venta (Bs)</label>
            <input className="input" type="number" inputMode="decimal" min="0.01" step="0.01" value={formEditar.precioVenta} onChange={(e) => setFormEditar((f) => ({ ...f, precioVenta: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Costo unitario (Bs)</label>
            <input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={formEditar.costoUnitario} onChange={(e) => setFormEditar((f) => ({ ...f, costoUnitario: e.target.value }))} />
          </div>

          {hayPreview && (
            <div style={{ background: "var(--color-surface2)", borderRadius: "var(--radius-md)", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-2)", marginBottom: "2px" }}>RESUMEN</p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span className="text-muted">Total vendido</span><span style={{ fontWeight: 500 }}>{formatBs(p * q)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span className="text-muted">Recuperación</span><span style={{ fontWeight: 500, color: "var(--color-warning)" }}>{formatBs(c * q)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", paddingTop: "8px", borderTop: "1px solid var(--color-border)" }}>
                <span style={{ fontWeight: 600 }}>Ganancia</span>
                <span style={{ fontWeight: 700, color: (p - c) * q >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>{formatBs((p - c) * q)}</span>
              </div>
            </div>
          )}

          {errorEditar && <div className="alert alert-danger">{errorEditar}</div>}
          <button className="btn btn-primary btn-full" onClick={guardarEdicionReporte} disabled={guardandoEditar} style={{ marginTop: "4px" }}>
            {guardandoEditar ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    );
  }

  // ── Vista: detalle de ventas ──────────────────────────────────────────────────
  if (vista === "detalle" && sesionSel) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <button onClick={() => setVista("resumen")} className="btn btn-ghost" style={{ height: "34px", padding: "0 12px" }}>
            <ArrowLeft size={15} /> Volver
          </button>
          <h2 style={{ fontSize: "1.1rem", flex: 1 }}>Detalle · {formatFecha(sesionSel.fecha)}</h2>
          <button className="btn btn-ghost" style={{ height: "34px", padding: "0 12px", fontSize: "0.8rem" }} onClick={imprimirReporte}>
            <Printer size={14} /> Imprimir
          </button>
        </div>

        {ventasSel.length === 0 ? (
          <p className="text-muted text-small" style={{ textAlign: "center", marginTop: "32px" }}>Sin ventas registradas en esta sesión.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {ventasSel.map((v) => (
              <div key={v.id} className="card" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 500, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.producto?.nombre ?? "Producto eliminado"}
                    </p>
                    <p className="text-muted text-small">{v.cantidad} u · {formatHora(v.fecha)}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                    <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>{formatBs(v.precioVenta * v.cantidad)}</p>
                    <p style={{ fontSize: "0.75rem", color: v.ganancia >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                      +{formatBs(v.ganancia)}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--color-border)", fontSize: "0.75rem" }}>
                  <span className="text-muted">Venta: {formatBs(v.precioVenta)}/u</span>
                  <span className="text-muted">Costo: {formatBs(v.costoPromedio)}/u</span>
                  <span className="text-muted">Recup: {formatBs(v.recuperacion)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--color-border)" }}>
                  <button className="btn btn-ghost btn-icon" title="Editar venta" onClick={() => abrirEditarReporte(v)} style={{ width: "30px", height: "30px" }}>
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-danger btn-icon" title="Eliminar venta" onClick={() => handleEliminarDeReporte(v)} style={{ width: "30px", height: "30px" }}>
                    <Trash2 size={13} />
                  </button>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Reporte</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-ghost" style={{ height: "34px", padding: "0 12px", fontSize: "0.8rem" }} onClick={exportarCSV} disabled={exportando}>
            <Download size={14} /> CSV
          </button>
          <button className="btn btn-ghost" style={{ height: "34px", padding: "0 12px", fontSize: "0.8rem" }} onClick={imprimirReporte} disabled={!sesionSel}>
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>

      {sesionSel && (
        <div className="card" style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{formatPeriodo(sesionSel)}</p>
              <p className="text-muted text-small">
                {ventasSel.length} venta{ventasSel.length !== 1 ? "s" : ""}{sesionSel.abierta ? " · en curso" : ""}
              </p>
            </div>
            <button className="btn btn-ghost" style={{ height: "32px", padding: "0 12px", fontSize: "0.8rem" }} onClick={() => setVista("detalle")}>
              Ver detalle
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span className="text-muted">Total vendido</span>
                <span style={{ fontWeight: 600 }}>{formatBs(sesionSel.totalVendido)}</span>
              </div>
              <PorcentajeBar valor={sesionSel.totalVendido} total={sesionSel.totalVendido} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span className="text-muted">Recuperación de capital</span>
                <span style={{ fontWeight: 600, color: "var(--color-warning)" }}>{formatBs(sesionSel.totalRecuperacion)}</span>
              </div>
              <PorcentajeBar valor={sesionSel.totalRecuperacion} total={sesionSel.totalVendido} color="var(--color-warning)" />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span style={{ fontWeight: 600 }}>Ganancia neta</span>
                <span style={{ fontWeight: 700, color: "var(--color-success)" }}>{formatBs(sesionSel.totalGanancia)}</span>
              </div>
              <PorcentajeBar valor={sesionSel.totalGanancia} total={sesionSel.totalVendido} color="var(--color-success)" />
            </div>
          </div>

          {sesionSel.totalVendido > 0 && (
            <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-muted text-small">Margen del período</span>
              <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--color-success)" }}>
                {((sesionSel.totalGanancia / sesionSel.totalVendido) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {sesiones.length > 1 && (
        <>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-2)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Historial
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {sesiones.slice(1).map((s) => (
              <button
                key={s.id}
                onClick={() => seleccionarSesion(s)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 14px",
                  background: sesionSel?.id === s.id ? "var(--color-surface2)" : "var(--color-surface)",
                  border: `1px solid ${sesionSel?.id === s.id ? "var(--color-primary)" : "var(--color-border)"}`,
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer", width: "100%", textAlign: "left", transition: "border-color 0.15s",
                }}
              >
                <div>
                  <p style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--color-text)" }}>{formatPeriodo(s)}</p>
                  <p className="text-muted text-small">{formatBs(s.totalVendido)} vendido{s.abierta ? " · en curso" : ""}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-success)" }}>{formatBs(s.totalGanancia)}</p>
                  <p className="text-muted text-small">
                    {s.totalVendido > 0 ? ((s.totalGanancia / s.totalVendido) * 100).toFixed(1) + "%" : "—"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {sesiones.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "48px", color: "var(--color-text-2)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📈</div>
          <p style={{ fontSize: "0.9rem" }}>Sin datos todavía. Registrá ventas para ver el reporte.</p>
        </div>
      )}
    </div>
  );
}
