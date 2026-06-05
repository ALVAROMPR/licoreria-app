import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';

function AppContent() {
  const { usuario, cargando } = useAuth();
  const [pagina, setPagina] = useState('dashboard');

  if (cargando) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-2)',
        fontSize: '0.9rem',
      }}>
        Cargando...
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  return <Layout pagina={pagina} setPagina={setPagina} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}