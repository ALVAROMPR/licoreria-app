// WebAuthn — autenticación biométrica con el autenticador de plataforma (huella, Face ID, etc.)

// Verifica si el dispositivo tiene autenticador biométrico disponible
export async function isBiometricAvailable() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Registra una credencial biométrica para el usuario
// Retorna { credentialId: number[], username: string }
// Lanza NotAllowedError si el usuario cancela
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
        authenticatorAttachment: 'platform', // usa el autenticador del dispositivo
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

// Autentica con huella/biometría usando una credencial ya registrada
// No lanza error = autenticación exitosa
// Lanza NotAllowedError si el usuario cancela o la huella no coincide
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
