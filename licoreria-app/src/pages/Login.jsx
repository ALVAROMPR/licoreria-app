import { useState } from 'react';
import { verificarLogin } from '../db';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

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
       console.log('resultado login:', usuario); //para ver si hay errores en la consulta
      if (!usuario) {
        setError('Usuario o contraseña incorrectos.');
        return;
      }
      login(usuario);
    } catch (err){        //quitar el err
      console.error('error login:', err); // ← y esto para ver si hay errores inesperados
      setError('Error al iniciar sesión. Intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Logo / título */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            margin: '0 auto 16px',
          }}>
            🍾
          </div>
          <h1 style={{ fontSize: '1.4rem' }}>Licorería</h1>
          <p className="text-muted text-small" style={{ marginTop: '4px' }}>
            Control de stock y ventas
          </p>
        </div>

        {/* Formulario */}
        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div className="input-group">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                className="input"
                type="text"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  className="input"
                  type={verPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(v => !v)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-2)',
                    fontSize: '1rem',
                    padding: '4px',
                    lineHeight: 1,
                  }}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {verPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger">{error}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={cargando}
              style={{ marginTop: '4px' }}
            >
              {cargando ? 'Verificando...' : 'Ingresar'}
            </button>

          </form>
        </div>

        <p className="text-muted text-small" style={{ textAlign: 'center', marginTop: '20px' }}>
          v1.0.0 · Solo uso local
        </p>
      </div>
    </div>
  );
}