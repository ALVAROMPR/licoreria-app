import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

function AppContent() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-2)',
      }}>
        Cargando...
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  // Aquí irá el layout principal en el Paso 4
  return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <p>✅ Sesión iniciada como <strong>{usuario.username}</strong></p>
      <p className="text-muted text-small" style={{ marginTop: '8px' }}>
        El layout principal se construye en el Paso 4.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}