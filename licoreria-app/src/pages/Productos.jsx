import { useState, useEffect } from "react";
import { db } from "../db";

const CATEGORIAS = [
  "Cerveza",
  "Vino",
  "Whisky",
  "Ron",
  "Vodka",
  "Pisco",
  "Singani",
  "Gin",
  "Tequila",
  "Gaseosa",
  "Agua",
  "Otro",
];

const UNIDADES = ["Botella", "Lata", "Caja", "Sixpack", "Unidad"];

const FORM_VACIO = { nombre: "", categoria: "Cerveza", unidad: "Botella" };

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarProductos();
  }, []);

  async function cargarProductos() {
    const lista = await db.productos.orderBy("nombre").toArray();
    setProductos(lista);
  }

  function abrirNuevo() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setError("");
    setMostrarForm(true);
  }

  function abrirEditar(producto) {
    setForm({
      nombre: producto.nombre,
      categoria: producto.categoria,
      unidad: producto.unidad,
    });
    setEditandoId(producto.id);
    setError("");
    setMostrarForm(true);
  }

  function cancelar() {
    setMostrarForm(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
    setError("");
  }

  async function guardar() {
    const nombre = form.nombre.trim();
    if (!nombre) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    // Verificar nombre duplicado
    const existente = await db.productos
      .where("nombre")
      .equalsIgnoreCase(nombre)
      .first();

    if (existente && existente.id !== editandoId) {
      setError("Ya existe un producto con ese nombre.");
      return;
    }

    setGuardando(true);
    try {
      if (editandoId) {
        await db.productos.update(editandoId, {
          nombre,
          categoria: form.categoria,
          unidad: form.unidad,
        });
      } else {
        await db.productos.add({
          nombre,
          categoria: form.categoria,
          unidad: form.unidad,
        });
      }
      await cargarProductos();
      cancelar();
    } catch {
      setError("Error al guardar. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(producto) {
    // Verificar si tiene lotes o ventas asociadas
    const lotes = await db.lotes
      .where("productoId")
      .equals(producto.id)
      .count();
    const ventas = await db.ventas
      .where("productoId")
      .equals(producto.id)
      .count();

    if (lotes > 0 || ventas > 0) {
      alert(
        `No se puede eliminar "${producto.nombre}" porque tiene ${lotes} lote(s) y ${ventas} venta(s) registradas.`,
      );
      return;
    }

    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;

    await db.productos.delete(producto.id);
    await cargarProductos();
  }

  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busqueda.toLowerCase()),
  );

  // ── Formulario ──────────────────────────────────────────────────────────────
  if (mostrarForm) {
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
          <button
            onClick={cancelar}
            className="btn btn-ghost"
            style={{ height: "34px", padding: "0 12px" }}
          >
            ← Volver
          </button>
          <h2 style={{ fontSize: "1.1rem" }}>
            {editandoId ? "Editar producto" : "Nuevo producto"}
          </h2>
        </div>

        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div className="input-group">
            <label>Nombre</label>
            <input
              className="input"
              type="text"
              placeholder="Ej: Ron Taíno 750ml"
              value={form.nombre}
              onChange={(e) =>
                setForm((f) => ({ ...f, nombre: e.target.value }))
              }
              autoFocus
            />
          </div>

          <div className="input-group">
            <label>Categoría</label>
            <select
              className="input"
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value }))
              }
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Unidad</label>
            <select
              className="input"
              value={form.unidad}
              onChange={(e) =>
                setForm((f) => ({ ...f, unidad: e.target.value }))
              }
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button
            className="btn btn-primary btn-full"
            onClick={guardar}
            disabled={guardando}
            style={{ marginTop: "4px" }}
          >
            {guardando
              ? "Guardando..."
              : editandoId
                ? "Guardar cambios"
                : "Agregar producto"}
          </button>
        </div>
      </div>
    );
  }

  // ── Lista de productos ───────────────────────────────────────────────────────
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
        <h2 style={{ fontSize: "1.1rem" }}>Productos</h2>
        <button
          className="btn btn-primary"
          style={{ height: "36px", padding: "0 14px", fontSize: "0.85rem" }}
          onClick={abrirNuevo}
        >
          + Nuevo
        </button>
      </div>

      <input
        className="input"
        type="search"
        placeholder="Buscar por nombre o categoría..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ marginBottom: "12px" }}
      />

      {productosFiltrados.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            marginTop: "48px",
            color: "var(--color-text-2)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📦</div>
          <p style={{ fontSize: "0.9rem" }}>
            {busqueda
              ? "Sin resultados."
              : "No hay productos. Agregá el primero."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {productosFiltrados.map((producto) => (
            <div
              key={producto.id}
              className="card"
              style={{
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontWeight: 500,
                    fontSize: "0.95rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {producto.nombre}
                </p>
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  <span className="badge badge-purple">
                    {producto.categoria}
                  </span>
                  <span className="badge badge-amber">{producto.unidad}</span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginLeft: "12px",
                  flexShrink: 0,
                }}
              >
                <button
                  className="btn btn-ghost"
                  style={{
                    height: "32px",
                    padding: "0 10px",
                    fontSize: "0.8rem",
                  }}
                  onClick={() => abrirEditar(producto)}
                >
                  Editar
                </button>
                <button
                  className="btn btn-danger"
                  style={{
                    height: "32px",
                    padding: "0 10px",
                    fontSize: "0.8rem",
                  }}
                  onClick={() => eliminar(producto)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p
        className="text-muted text-small"
        style={{ textAlign: "center", marginTop: "16px" }}
      >
        {productosFiltrados.length} producto
        {productosFiltrados.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
