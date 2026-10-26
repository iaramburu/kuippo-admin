import type { LoginSession, MfaMethod } from './types';

/** The three second factors, in the order they are offered. */
export const MFA_METHODS: { id: MfaMethod; label: string; hint: string }[] = [
  { id: 'email', label: 'Correo electrónico', hint: 'Te enviamos un código de 6 dígitos a tu correo.' },
  { id: 'totp', label: 'App de autenticación', hint: 'El código de una app como Google Authenticator, Microsoft Authenticator o FreeOTP.' },
  { id: 'webauthn', label: 'Llave de seguridad o biometría', hint: 'La huella, el rostro o el PIN de este dispositivo, o una llave física (YubiKey).' },
];

/** "3 dispositivos de confianza", "1 dispositivo de confianza", "Ningún dispositivo de confianza". */
export function trustedDevicesText(count: number): string {
  if (count <= 0) return 'Ningún dispositivo de confianza.';
  return `${count} ${count === 1 ? 'dispositivo' : 'dispositivos'} de confianza.`;
}

/** The sessions with the one of this device first, then the most recently used. */
export function orderSessions(sessions: LoginSession[]): LoginSession[] {
  return [...sessions].sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.lastAccess) - Date.parse(a.lastAccess));
}

/** Where the session was used from: the applications and the address it came from. */
export function describeSession(session: LoginSession): string {
  const apps = session.clients.length > 0 ? session.clients.join(', ') : 'Kuippo';
  return session.ip ? `${apps} · ${session.ip}` : apps;
}

const dateTime = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "Último uso: 22 oct, 11:30". */
export function lastUseText(session: LoginSession): string {
  const at = new Date(session.lastAccess);
  return Number.isNaN(at.getTime()) ? '' : `Último uso: ${dateTime.format(at)}`;
}

/** The name of the file of the copy of the account's data. */
export function exportFileName(date: Date): string {
  return `kuippo-mis-datos-${date.toISOString().slice(0, 10)}.json`;
}

/** What is wrong with a new password, or null when it can be sent. */
export function passwordProblem(current: string, next: string, repeated: string): string | null {
  if (!current) return 'Indica tu contraseña actual.';
  if (next.length < 8) return 'La nueva contraseña necesita 8 caracteres como mínimo.';
  if (next.length > 128) return 'La nueva contraseña admite 128 caracteres como máximo.';
  if (next === current) return 'La nueva contraseña debe ser distinta de la actual.';
  if (next !== repeated) return 'Las contraseñas no coinciden.';
  return null;
}
