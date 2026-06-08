import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Dashboard from "../pages/Dashboard";
import Productos from "../pages/Productos";
import Stock from "../pages/Stock";
import Ventas from "../pages/Ventas";
import Reporte from "../pages/Reporte";
import Configuracion from "../pages/Configuracion";
import {
  LayoutDashboard, Package, Warehouse,
  ShoppingCart, BarChart3, Settings, LogOut,
  Sun, Moon,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Inicio",    Icon: LayoutDashboard },
  { id: "productos", label: "Productos", Icon: Package          },
  { id: "stock",     label: "Stock",     Icon: Warehouse        },
  { id: "ventas",    label: "Ventas",    Icon: ShoppingCart     },
  { id: "reporte",   label: "Reporte",   Icon: BarChart3        },
];

export default function Layout({ pagina, setPagina }) {
  const { usuario, logout } = useAuth();

  const [tema, setTema] = useState(
    () => localStorage.getItem("licoreria_tema") ?? "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem("licoreria_tema", tema);
  }, [tema]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", maxWidth: "480px", margin: "0 auto" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 16px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/icon-512.png" alt="Logo" style={{ height: "32px", width: "32px", objectFit: "contain", borderRadius: "8px" }} />
          <div style={{ lineHeight: 1.25 }}>
            <p style={{ fontWeight: 700, fontSize: "0.875rem" }}>Catering Services</p>
            <p style={{ fontSize: "0.65rem", color: "var(--color-text-2)" }}>Sil&amp;Te · Gestión de Ventas</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => setTema(t => t === "dark" ? "light" : "dark")}
            className="btn btn-ghost btn-icon"
            title={tema === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          >
            {tema === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            onClick={() => setPagina("configuracion")}
            className="btn btn-ghost btn-icon"
            title={`Configuración (${usuario.username})`}
            style={{
              color:       pagina === "configuracion" ? "var(--color-primary)" : undefined,
              background:  pagina === "configuracion" ? "var(--color-primary-dim)" : undefined,
              borderColor: pagina === "configuracion" ? "transparent" : undefined,
            }}
          >
            <Settings size={17} />
          </button>
          <button onClick={logout} className="btn btn-ghost btn-icon" title="Cerrar sesión">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* ── Contenido ──────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "16px", paddingBottom: "84px", overflowY: "auto" }}>
        {pagina === "dashboard"     && <Dashboard setPagina={setPagina} />}
        {pagina === "productos"     && <Productos />}
        {pagina === "stock"         && <Stock />}
        {pagina === "ventas"        && <Ventas setPagina={setPagina} />}
        {pagina === "reporte"       && <Reporte />}
        {pagina === "configuracion" && <Configuracion />}
      </main>

      {/* ── Navegación inferior ────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: "480px",
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        display: "flex", zIndex: 10,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const activo = pagina === id;
          return (
            <button
              key={id}
              onClick={() => setPagina(id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: "3px", padding: "9px 4px",
                background: "none", border: "none", cursor: "pointer",
                color: activo ? "var(--color-primary)" : "var(--color-text-3)",
                transition: "color 0.15s",
              }}
            >
              {activo
                ? <div className="nav-pill"><Icon size={19} strokeWidth={2.2} /></div>
                : <Icon size={19} strokeWidth={1.7} />
              }
              <span className="nav-label" style={{ color: activo ? "var(--color-primary)" : "var(--color-text-3)" }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
