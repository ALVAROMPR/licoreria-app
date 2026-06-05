import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const SESSION_KEY = 'licoreria_session';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al montar, revisar si hay sesión guardada en sessionStorage
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
    // Guardamos solo id y username — nunca el hash
    const sesion = { id: usuarioData.id, username: usuarioData.username };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
    setUsuario(sesion);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}