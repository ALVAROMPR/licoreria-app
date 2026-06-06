import { useState, useEffect } from 'react';
import { Eye, EyeOff, LogIn, Fingerprint, ChevronRight, ChevronLeft } from 'lucide-react';
import { verificarLogin, getBiometria, guardarBiometria, getUsuarioPorUsername } from '../db';
import { isBiometricAvailable, registrarBiometrico, autenticarBiometrico } from '../utils/webauthn';
import { useAuth } from '../context/AuthContext';

const BIO_SKIP_KEY = 'licoreria_bio_skip';

export default function Login() {
  const { login } = useAuth();

  // modo: "cargando" | "biometrico" | "manual" | "oferta"
  const [modo, setModo]                     = useState('cargando');
  const [biometriaDisponible, setBioDisp]   = useState(false);
  const [pendingUsuario, setPendingUsuario] = useState(null);

  // Formulario manual
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [verPassword, setVerPass] = useState(false);
  const [error, setError]         = useState('');
  const [cargando, setCargando]   = useState(false);

  // Estado biométrico
  const [cargandoBio, setCargandoBio] = useState(false);

  useEffect(() => {
    async function inicializar() {
      const disponible = await isBiometricAvailable();
      setBioDisp(disponible);
      if (disponible) {
        const registrada = await getBiometria();
        if (registrada) {
          setModo('biometrico');
          return;
        }
      }
      setModo('manual');
    }
    inicializar();
  }, []);

  // ── Autenticación con huella ────────────────────────────────────────────────
  async function handleLoginBiometrico() {
    setError('');
    setCargandoBio(true);
    try {
      const bio = await getBiometria();
      if (!bio) { setModo('manual'); return; }

      await autenticarBiometrico(bio.credentialId);

      const usuario = await getUsuarioPorUsername(bio.username);
      if (!usuario) {
        setError('Usuario no encontrado. Ingresá con contraseña.');
        setModo('manual');
        return;
      }
      login(usuario);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Verificación cancelada.');
      } else {
        setError('No se pudo verificar la huella. Ingresá con contraseña.');
        setModo('manual');
      }
    } finally {
      setCargandoBio(false);
    }
  }

  // ── Login manual ────────────────────────────────────────────────────────────
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

      // Ofrecer biometría si está disponible y no configurada y no fue omitida
      if (biometriaDisponible && localStorage.getItem(BIO_SKIP_KEY) !== '1') {
        const bio = await getBiometria();
        if (!bio) {
          setPendingUsuario(usuario);
          setModo('oferta');
          return;
        }
      }
      login(usuario);
    } catch {
      setError('Error al iniciar sesión. Intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  // ── Registro de huella (desde oferta post-login) ────────────────────────────
  async function handleHabilitarBiometria() {
    if (!pendingUsuario) return;
    setCargandoBio(true);
    setError('');
    try {
      const { credentialId, username: uname } = await registrarBiometrico(
        pendingUsuario.id,
        pendingUsuario.username,
      );
      await guardarBiometria(credentialId, uname);
      localStorage.removeItem(BIO_SKIP_KEY);
      login(pendingUsuario);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Registro cancelado.');
      } else {
        setError('No se pudo configurar. Podés intentarlo desde Configuración.');
        login(pendingUsuario);
      }
    } finally {
      setCargandoBio(false);
    }
  }

  function handleOmitirOferta() {
    localStorage.setItem(BIO_SKIP_KEY, '1');
    login(pendingUsuario);
  }

  // ── Branding compartido ──────────────────────────────────────────────────────
  const Branding = () => (
    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
      <div style={{
        width: '80px', height: '80px', borderRadius: '22px',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
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
  );

  const wrapper = (children) => (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <Branding />
        {children}
        <p className="text-xs text-muted" style={{ textAlign: 'center', marginTop: '18px' }}>
          v1.0.0 · Solo uso local
        </p>
      </div>
    </div>
  );

  // ── Pantalla: cargando ───────────────────────────────────────────────────────
  if (modo === 'cargando') {
    return wrapper(
      <div style={{ textAlign: 'center', color: 'var(--color-text-2)', padding: '32px 0' }}>
        Cargando...
      </div>
    );
  }

  // ── Pantalla: oferta de biometría ────────────────────────────────────────────
  if (modo === 'oferta') {
    return wrapper(
      <div className="card" style={{ padding: '28px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '18px',
          background: 'var(--color-primary-dim)',
          border: '1px solid rgba(124,111,239,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <Fingerprint size={30} color="var(--color-primary)" strokeWidth={1.5} />
        </div>

        <h2 style={{ fontSize: '1.05rem', marginBottom: '8px', textAlign: 'center' }}>
          Acceso con huella digital
        </h2>
        <p className="text-muted text-small" style={{ textAlign: 'center', lineHeight: 1.6, marginBottom: '24px' }}>
          La próxima vez podés ingresar sin contraseña usando la huella o reconocimiento facial de tu dispositivo.
        </p>

        {error && <div className="alert alert-danger" style={{ width: '100%', marginBottom: '12px' }}>{error}</div>}

        <button
          className="btn btn-primary btn-full"
          onClick={handleHabilitarBiometria}
          disabled={cargandoBio}
          style={{ height: '44px', fontSize: '0.9375rem', marginBottom: '10px' }}
        >
          {cargandoBio
            ? 'Configurando...'
            : <><Fingerprint size={17} /> Habilitar huella digital</>
          }
        </button>

        <button
          className="btn btn-ghost btn-full"
          onClick={handleOmitirOferta}
          disabled={cargandoBio}
          style={{ height: '40px', fontSize: '0.875rem' }}
        >
          Omitir por ahora
        </button>
      </div>
    );
  }

  // ── Pantalla: login biométrico ───────────────────────────────────────────────
  if (modo === 'biometrico') {
    return wrapper(
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="card" style={{ padding: '32px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'var(--color-primary-dim)',
            border: '1px solid rgba(124,111,239,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '18px',
          }}>
            <Fingerprint size={36} color="var(--color-primary)" strokeWidth={1.4} />
          </div>

          <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '6px' }}>
            Verificar identidad
          </p>
          <p className="text-muted text-small" style={{ textAlign: 'center', lineHeight: 1.6, marginBottom: '22px' }}>
            Usá tu huella digital o reconocimiento facial para ingresar.
          </p>

          {error && <div className="alert alert-danger" style={{ width: '100%', marginBottom: '12px' }}>{error}</div>}

          <button
            className="btn btn-primary btn-full"
            onClick={handleLoginBiometrico}
            disabled={cargandoBio}
            style={{ height: '44px', fontSize: '0.9375rem' }}
          >
            {cargandoBio
              ? 'Verificando...'
              : <><Fingerprint size={17} /> Ingresar con huella</>
            }
          </button>
        </div>

        <button
          className="btn btn-ghost btn-full"
          onClick={() => { setError(''); setModo('manual'); }}
          style={{ height: '40px', fontSize: '0.875rem' }}
        >
          <ChevronRight size={15} /> Ingresar con contraseña
        </button>
      </div>
    );
  }

  // ── Pantalla: login manual ───────────────────────────────────────────────────
  return wrapper(
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Volver a biometría si está registrada */}
      {biometriaDisponible && modo === 'manual' && (
        <button
          className="btn btn-ghost btn-full"
          onClick={async () => {
            const bio = await getBiometria();
            if (bio) { setError(''); setModo('biometrico'); }
          }}
          style={{ height: '40px', fontSize: '0.875rem' }}
        >
          <Fingerprint size={15} /> Usar huella digital
          <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
        </button>
      )}

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
                onClick={() => setVerPass(v => !v)}
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
    </div>
  );
}
