import { useState } from 'react';
import { verificarLogin } from '../db';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [error, setError]               = useState('');
  const [cargando, setCargando]         = useState(false);
  const [verPassword, setVerPassword]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Ingresá usuario y contraseña.');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const usuario = await verificarLogin(username.trim(), password);
      if (!usuario) { setError('Usuario o contraseña incorrectos.'); return; }
      login(usuario);
    } catch {
      setError('Error al iniciar sesión. Intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '80px', height: '80px',
            borderRadius: '22px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 4px 24px rgba(124,111,239,0.18)',
          }}>
            <img src="/icon-512.png" alt="Logo" style={{ width: '54px', height: '54px', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
            Catering Services Sil&amp;Te
          </h1>
          <p className="text-muted text-small" style={{ marginTop: '5px' }}>
            Sistema de gestión de ventas · Licorería
          </p>
        </div>

        {/* Formulario */}
        <div className="card" style={{ padding: '22px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div className="input-group">
              <label htmlFor="username">Usuario</label>
              <input
                id="username" className="input" type="text"
                placeholder="admin"
                value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" autoCapitalize="none" spellCheck={false}
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password" className="input"
                  type={verPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '11px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-2)', padding: '4px',
                    display: 'flex', alignItems: 'center', lineHeight: 1,
                  }}
                  aria-label={verPassword ? 'Ocultar' : 'Ver contraseña'}
                >
                  {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <button
              type="submit" className="btn btn-primary btn-full"
              disabled={cargando}
              style={{ height: '44px', fontSize: '0.9375rem', marginTop: '4px' }}
            >
              {cargando ? 'Verificando...' : <><LogIn size={17} /> Ingresar</>}
            </button>
          </form>
        </div>

        <p className="text-xs text-muted" style={{ textAlign: 'center', marginTop: '18px' }}>
          v1.0.0 · Solo uso local
        </p>
      </div>
    </div>
  );
}
