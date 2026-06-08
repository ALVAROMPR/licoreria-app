import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

const AuthContext = createContext(null);
const SESSION_KEY = "licoreria_session";
const SESSION_DURATION = 3 * 60 * 60 * 1000; // 3 horas en ms

function obtenerSesionValida() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const sesion = JSON.parse(raw);
    if (!sesion.loginAt || Date.now() - sesion.loginAt > SESSION_DURATION) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return sesion;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState("dashboard");

  useEffect(() => {
    const sesion = obtenerSesionValida();
    if (sesion) setUsuario(sesion);
    setCargando(false);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        if (!obtenerSesionValida()) {
          setUsuario(null);
          setPagina("dashboard");
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  function login(usuarioData) {
    const sesion = {
      id: usuarioData.id,
      username: usuarioData.username,
      loginAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
    setPagina("dashboard");
    setUsuario(sesion);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setPagina("dashboard");
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, login, logout, cargando, pagina, setPagina }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
