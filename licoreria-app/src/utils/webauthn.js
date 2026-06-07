// WebAuthn — autenticación biométrica con el autenticador de plataforma

// Detecta si se está ejecutando en un dispositivo móvil
function esMobil() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Verifica si el dispositivo soporta biometría WebAuthn.
// Algunos dispositivos Android (Xiaomi HyperOS, ciertas versiones de Samsung Browser)
// reportan UVPA=false aunque sí tengan huella hardware.
// En esos casos usamos el UA como fallback para mostrar la opción y dejar
// que el dispositivo falle con un error descriptivo si realmente no la soporta.
export async function isBiometricAvailable() {
  // WebAuthn requiere HTTPS (o localhost en desarrollo)
  if (!window.isSecureContext) return false;
  // Necesita la API base de WebAuthn
  if (!window.PublicKeyCredential) return false;

  try {
    const uvpa = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (uvpa) return true;
  } catch {
    // La comprobación UVPA falló — en móvil intentamos igual
  }

  // UVPA=false pero podría ser un reporte incorrecto del browser.
  // En móvil mostramos la opción; si el dispositivo no la soporta de verdad
  // recibiremos un error tipado al intentar usarla.
  return esMobil();
}

// Registra una credencial biométrica para el usuario.
// Retorna { credentialId: number[], username }
// Errores posibles: NotAllowedError, NotSupportedError, SecurityError, InvalidStateError
export async function registrarBiometrico(userId, username) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Catering Services Sil&Te',
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(String(userId)),
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { alg: -7,   type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  });

  return {
    credentialId: Array.from(new Uint8Array(credential.rawId)),
    username,
  };
}

// Autentica con huella/biometría usando una credencial ya registrada.
// Sin error = autenticación exitosa.
// Errores posibles: NotAllowedError, NotSupportedError, SecurityError
export async function autenticarBiometrico(credentialId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{
        id: new Uint8Array(credentialId),
        type: 'public-key',
      }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
}

// Mapea el nombre de error WebAuthn a un mensaje legible en español
export function mensajeErrorBio(err) {
  const mapa = {
    NotAllowedError:  'Cancelado o tiempo agotado. Intentá de nuevo.',
    NotSupportedError:'Este dispositivo no admite autenticación biométrica.',
    SecurityError:    'Error de seguridad. Asegurate de usar la URL HTTPS de la app.',
    InvalidStateError:'Ya existe una credencial para este dispositivo.',
    AbortError:       'Operación cancelada.',
  };
  return mapa[err?.name] ?? 'No se pudo completar. Intentá de nuevo.';
}
