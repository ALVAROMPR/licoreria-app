import { useAuth } from "../context/AuthContext";
import Dashboard from "../pages/Dashboard";
import Productos from "../pages/Productos";
import Stock from "../pages/Stock";
import Ventas from "../pages/Ventas";
import Reporte from "../pages/Reporte";
import Configuracion from "../pages/Configuracion";

const NAV_ITEMS = [
  { id: "dashboard", label: "Inicio", icon: "📊" },
  { id: "productos", label: "Productos", icon: "📦" },
  { id: "stock", label: "Stock", icon: "🏪" },
  { id: "ventas", label: "Ventas", icon: "🛒" },
  { id: "reporte", label: "Reporte", icon: "📈" },
];

export default function Layout({ pagina, setPagina }) {
  const { usuario, logout } = useAuth();

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img
            src="/LOGO CATERING SERVICES SIL&TE.png"
            alt="Logo"
            style={{ height: "32px", width: "32px", objectFit: "contain" }}
          />
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Catering Services Sil&amp;Te</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setPagina("configuracion")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 8px",
              borderRadius: "var(--radius-sm)",
              color:
                pagina === "configuracion"
                  ? "var(--color-primary)"
                  : "var(--color-text-2)",
              fontSize: "0.85rem",
            }}
          >
            <span style={{ fontSize: "1rem" }}>⚙️</span>
            <span>{usuario.username}</span>
          </button>
          <button
            onClick={logout}
            className="btn btn-ghost"
            style={{ height: "34px", padding: "0 12px", fontSize: "0.8rem" }}
          >
            Salir
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main
        style={{
          flex: 1,
          padding: "16px",
          paddingBottom: "80px",
          overflowY: "auto",
        }}
      >
        {pagina === "dashboard" && <Dashboard setPagina={setPagina} />}
        {pagina === "productos" && <Productos />}
        {pagina === "stock" && <Stock />}
        {pagina === "ventas" && <Ventas />}
        {pagina === "reporte" && <Reporte />}
        {pagina === "configuracion" && <Configuracion />}
      </main>

      {/* Navegación inferior */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "480px",
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          zIndex: 10,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const activo = pagina === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPagina(item.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                padding: "10px 4px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: activo ? "var(--color-primary)" : "var(--color-text-2)",
                borderTop: activo
                  ? "2px solid var(--color-primary)"
                  : "2px solid transparent",
                transition: "color 0.15s",
              }}
            >
              <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>
                {item.icon}
              </span>
              <span
                style={{ fontSize: "0.65rem", fontWeight: activo ? 600 : 400 }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
