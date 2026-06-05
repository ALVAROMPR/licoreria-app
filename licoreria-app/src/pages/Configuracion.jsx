import { useState, useRef } from "react";
import { cambiarPassword, db } from "../db";
import { useAuth } from "../context/AuthContext";

export default function Configuracion() {
  const { usuario } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    actual: "",
    nueva: "",
    confirmacion: "",
  });
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [verActual, setVerActual] = useState(false);
  const [verNueva, setVerNueva] = useState(false);

  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [errorBackup, setErrorBackup] = useState("");
  const [exitoBackup, setExitoBackup] = useState("");

  // ── Cambio de contraseña ───────────────────────────────────────────────────
  async function handleCambiar() {
    setError("");
    setExito("");

    if (!form.actual || !form.nueva || !form.confirmacion) {
      setError("Completá todos los campos.");
      return;
    }
    if (form.nueva.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.nueva !== form.confirmacion) {
      setError("La nueva contraseña y la confirmación no coinciden.");
      return;
    }
    if (form.nueva === form.actual) {
      setError("La nueva contraseña debe ser diferente a la actual.");
      return;
    }

    setGuardando(true);
    try {
      const { verificarLogin } = await import("../db");
      const verificado = await verificarLogin(usuario.username, form.actual);
      if (!verificado) {
        setError("La contraseña actual es incorrecta.");
        return;
      }
      await cambiarPassword(usuario.id, form.nueva);
      setExito("Contraseña actualizada correctamente.");
      setForm({ actual: "", nueva: "", confirmacion: "" });
    } catch {
      setError("Error al cambiar la contraseña. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  // ── Exportar JSON ──────────────────────────────────────────────────────────
  async function exportarJSON() {
    setExportando(true);
    setErrorBackup("");
    setExitoBackup("");
    try {
      const [productos, lotes, ventas, sesiones] = await Promise.all([
        db.productos.toArray(),
        db.lotes.toArray(),
        db.ventas.toArray(),
        db.sesiones_venta.toArray(),
      ]);

      const datos = {
        version: 1,
        exportado: new Date().toISOString(),
        productos,
        lotes,
        ventas,
        sesiones,
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
      setExitoBackup("Respaldo exportado correctamente.");
    } catch {
      setErrorBackup("Error al exportar. Intentá de nuevo.");
    } finally {
      setExportando(false);
    }
  }

  // ── Importar JSON ──────────────────────────────────────────────────────────
  async function handleArchivoSeleccionado(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    // Limpiar el input para permitir reimportar el mismo archivo
    e.target.value = "";

    setErrorBackup("");
    setExitoBackup("");

    if (!archivo.name.endsWith(".json")) {
      setErrorBackup("El archivo debe ser un JSON exportado desde esta app.");
      return;
    }

    const confirmar = window.confirm(
      "⚠️ Esto reemplazará TODOS los datos actuales con los del archivo.\n\n¿Estás seguro?",
    );
    if (!confirmar) return;

    setImportando(true);
    try {
      const texto = await archivo.text();
      const datos = JSON.parse(texto);

      // Validar estructura básica
      if (
        !datos.version ||
        !datos.productos ||
        !datos.lotes ||
        !datos.ventas ||
        !datos.sesiones
      ) {
        setErrorBackup("El archivo no es un respaldo válido de esta app.");
        return;
      }

      // Restaurar dentro de una transacción
      await db.transaction(
        "rw",
        [db.productos, db.lotes, db.ventas, db.sesiones_venta],
        async () => {
          // Limpiar tablas actuales
          await Promise.all([
            db.productos.clear(),
            db.lotes.clear(),
            db.ventas.clear(),
            db.sesiones_venta.clear(),
          ]);

          // Restaurar datos — bulkAdd con los IDs originales
          if (datos.productos.length > 0)
            await db.productos.bulkAdd(datos.productos);
          if (datos.lotes.length > 0) await db.lotes.bulkAdd(datos.lotes);
          if (datos.ventas.length > 0) await db.ventas.bulkAdd(datos.ventas);
          if (datos.sesiones.length > 0)
            await db.sesiones_venta.bulkAdd(datos.sesiones);
        },
      );

      const fecha = new Date(datos.exportado).toLocaleDateString("es-BO");
      setExitoBackup(
        `Datos restaurados correctamente. Respaldo del ${fecha}. Se importaron ${datos.productos.length} productos, ${datos.ventas.length} ventas.`,
      );
    } catch (err) {
      if (err instanceof SyntaxError) {
        setErrorBackup("El archivo está dañado o no es un JSON válido.");
      } else {
        setErrorBackup("Error al importar: " + err.message);
      }
    } finally {
      setImportando(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h2 style={{ fontSize: "1.1rem" }}>Configuración</h2>

      {/* Info del usuario */}
      <div
        className="card"
        style={{ display: "flex", alignItems: "center", gap: "14px" }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            fontWeight: 700,
            flexShrink: 0,
            color: "#fff",
          }}
        >
          {usuario.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <p style={{ fontWeight: 600 }}>{usuario.username}</p>
          <p className="text-muted text-small">Administrador</p>
        </div>
      </div>

      {/* Cambio de contraseña */}
      <div
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <h3 style={{ fontSize: "0.95rem" }}>Cambiar contraseña</h3>

        <div className="input-group">
          <label>Contraseña actual</label>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={verActual ? "text" : "password"}
              placeholder="••••••••"
              value={form.actual}
              onChange={(e) =>
                setForm((f) => ({ ...f, actual: e.target.value }))
              }
              style={{ paddingRight: "44px" }}
            />
            <button
              type="button"
              onClick={() => setVerActual((v) => !v)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-2)",
                fontSize: "1rem",
                padding: "4px",
                lineHeight: 1,
              }}
            >
              {verActual ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        <div className="input-group">
          <label>Nueva contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={verNueva ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={form.nueva}
              onChange={(e) =>
                setForm((f) => ({ ...f, nueva: e.target.value }))
              }
              style={{ paddingRight: "44px" }}
            />
            <button
              type="button"
              onClick={() => setVerNueva((v) => !v)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-2)",
                fontSize: "1rem",
                padding: "4px",
                lineHeight: 1,
              }}
            >
              {verNueva ? "🙈" : "👁️"}
            </button>
          </div>
          {form.nueva.length > 0 && (
            <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    flex: 1,
                    height: "3px",
                    borderRadius: "999px",
                    transition: "background 0.2s",
                    background:
                      form.nueva.length >= n * 4
                        ? n === 1
                          ? "var(--color-danger)"
                          : n === 2
                            ? "var(--color-warning)"
                            : "var(--color-success)"
                        : "var(--color-border)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="input-group">
          <label>Confirmar nueva contraseña</label>
          <input
            className="input"
            type="password"
            placeholder="••••••••"
            value={form.confirmacion}
            onChange={(e) =>
              setForm((f) => ({ ...f, confirmacion: e.target.value }))
            }
          />
          {form.confirmacion.length > 0 && form.nueva !== form.confirmacion && (
            <span
              style={{
                fontSize: "0.78rem",
                color: "var(--color-danger)",
                marginTop: "2px",
              }}
            >
              Las contraseñas no coinciden.
            </span>
          )}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {exito && <div className="alert alert-success">{exito}</div>}

        <button
          className="btn btn-primary btn-full"
          onClick={handleCambiar}
          disabled={guardando}
        >
          {guardando ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </div>

      {/* Respaldo de datos */}
      <div
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <h3 style={{ fontSize: "0.95rem" }}>Respaldo de datos</h3>

        <p className="text-muted text-small" style={{ lineHeight: 1.6 }}>
          Los datos se guardan en este dispositivo. Exportá un respaldo JSON
          regularmente para no perder información si se borra el caché del
          navegador.
        </p>

        {errorBackup && <div className="alert alert-danger">{errorBackup}</div>}
        {exitoBackup && (
          <div className="alert alert-success">{exitoBackup}</div>
        )}

        {/* Exportar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "var(--color-text-2)",
            }}
          >
            Exportar respaldo
          </p>
          <button
            className="btn btn-ghost btn-full"
            onClick={exportarJSON}
            disabled={exportando || importando}
            style={{ justifyContent: "flex-start", gap: "10px" }}
          >
            <span style={{ fontSize: "1.1rem" }}>💾</span>
            {exportando ? "Exportando..." : "Exportar JSON"}
          </button>
        </div>

        {/* Importar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "var(--color-text-2)",
            }}
          >
            Restaurar desde respaldo
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleArchivoSeleccionado}
            style={{ display: "none" }}
          />
          <button
            className="btn btn-ghost btn-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={importando || exportando}
            style={{ justifyContent: "flex-start", gap: "10px" }}
          >
            <span style={{ fontSize: "1.1rem" }}>📂</span>
            {importando ? "Importando..." : "Importar JSON"}
          </button>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-3)",
              lineHeight: 1.5,
            }}
          >
            ⚠️ Reemplaza todos los datos actuales con los del archivo.
          </p>
        </div>
      </div>
    </div>
  );
}
