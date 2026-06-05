import { useState } from "react";
import { cambiarPassword } from "../db";
import { useAuth } from "../context/AuthContext";

export default function Configuracion() {
  const { usuario } = useAuth();

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
      // Verificar contraseña actual
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

  return (
    <div>
      <h2 style={{ fontSize: "1.1rem", marginBottom: "20px" }}>
        Configuración
      </h2>

      {/* Info del usuario */}
      <div
        className="card"
        style={{
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
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
          {/* Indicador de fuerza */}
          {form.nueva.length > 0 && (
            <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    flex: 1,
                    height: "3px",
                    borderRadius: "999px",
                    background:
                      form.nueva.length >= n * 4
                        ? n === 1
                          ? "var(--color-danger)"
                          : n === 2
                            ? "var(--color-warning)"
                            : "var(--color-success)"
                        : "var(--color-border)",
                    transition: "background 0.2s",
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
          style={{ marginTop: "4px" }}
        >
          {guardando ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </div>
    </div>
  );
}
