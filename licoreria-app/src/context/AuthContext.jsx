import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const AuthContext = createContext(null);
const SESSION_KEY = "licoreria_session";

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState("dashboard");

  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(SESSION_KEY);
      if (guardado) {
        setUsuario(JSON.parse(guardado));
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    } finally {
      setCargando(false);
    }
  }, []);

  function login(usuarioData) {
    const sesion = { id: usuarioData.id, username: usuarioData.username };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
    setPagina("dashboard"); // siempre resetear al login
    setUsuario(sesion);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setPagina("dashboard"); // limpiar también al salir
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
