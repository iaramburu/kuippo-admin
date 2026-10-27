import { describe, expect, it } from 'vitest';
import { describeSession, exportFileName, lastUseText, methodStates, methodSummary, orderSessions, passwordProblem, trustedDevicesText } from './security';
import type { LoginSession } from './types';

const session = (over: Partial<LoginSession>): LoginSession => ({
  id: 'a',
  ip: '',
  startedAt: '2026-10-01T10:00:00Z',
  lastAccess: '2026-10-01T10:00:00Z',
  clients: [],
  current: false,
  ...over,
});

describe('security helpers', () => {
  it('counts the trusted devices in words', () => {
    expect(trustedDevicesText(0)).toBe('Ningún dispositivo de confianza.');
    expect(trustedDevicesText(1)).toBe('1 dispositivo de confianza.');
    expect(trustedDevicesText(3)).toBe('3 dispositivos de confianza.');
  });

  it('puts the session of this device first, then the latest used', () => {
    const old = session({ id: 'old', lastAccess: '2026-10-01T10:00:00Z' });
    const recent = session({ id: 'recent', lastAccess: '2026-10-05T10:00:00Z' });
    const mine = session({ id: 'mine', current: true, lastAccess: '2026-09-01T10:00:00Z' });
    expect(orderSessions([old, recent, mine]).map((s) => s.id)).toEqual(['mine', 'recent', 'old']);
  });

  it('says where a session was used from', () => {
    expect(describeSession(session({ clients: ['Kuippo', 'admin-console'], ip: '1.2.3.4' }))).toBe('Kuippo, admin-console · 1.2.3.4');
    expect(describeSession(session({}))).toBe('Kuippo');
    expect(lastUseText(session({ lastAccess: 'no es una fecha' }))).toBe('');
  });

  it('names the file of the copy of the data', () => {
    expect(exportFileName(new Date('2026-10-26T12:00:00Z'))).toBe('kuippo-mis-datos-2026-10-26.json');
  });

  it('checks a new password before sending it', () => {
    expect(passwordProblem('', 'abcdefghijkl', 'abcdefghijkl')).toMatch(/actual/);
    expect(passwordProblem('old-password', 'short', 'short')).toMatch(/12 caracteres/);
    expect(passwordProblem('old-password', 'eleven-char', 'eleven-char')).toMatch(/12 caracteres/);
    expect(passwordProblem('old-password', 'old-password', 'old-password')).toMatch(/distinta/);
    expect(passwordProblem('old-password', 'new-password', 'other-password')).toMatch(/no coinciden/);
    expect(passwordProblem('old-password', 'new-password', 'new-password')).toBeNull();
  });
});

describe('methodStates (the administration never uses the e-mail)', () => {
  const none = { method: 'email', appConfigured: false, keyConfigured: false, trustedDevices: 0 } as const;
  const ids = (security: Parameters<typeof methodStates>[0]) => methodStates(security).map((s) => s.id);
  const state = (security: Parameters<typeof methodStates>[0], id: string) => methodStates(security).find((s) => s.id === id)!;

  it('offers only the app and the key', () => {
    expect(ids(none)).toEqual(['totp', 'webauthn']);
  });

  it('with nothing set up, nothing is in use and it says what is required', () => {
    expect(methodStates(none).some((s) => s.isDefault)).toBe(false);
    expect(state(none, 'totp').usage).toMatch(/hasta que lo configures/);
    expect(methodSummary(none)).toMatch(/exige una app de autenticación o una llave/);
  });

  it('an account whose default is still the e-mail uses the first method that is set up', () => {
    const app = { method: 'email', appConfigured: true, keyConfigured: false, trustedDevices: 0 } as const;
    expect(methodStates(app).filter((s) => s.isDefault).map((s) => s.id)).toEqual(['totp']);
    const both = { method: 'email', appConfigured: true, keyConfigured: true, trustedDevices: 0 } as const;
    expect(methodStates(both).filter((s) => s.isDefault).map((s) => s.id)).toEqual(['totp']);
    expect(state(both, 'webauthn').usage).toMatch(/lo puedes elegir en la pantalla de verificación/);
  });

  it('keeps the default the account chose', () => {
    const key = { method: 'webauthn', appConfigured: true, keyConfigured: true, trustedDevices: 0 } as const;
    expect(methodStates(key).filter((s) => s.isDefault).map((s) => s.id)).toEqual(['webauthn']);
    expect(methodSummary(key)).toMatch(/Método por defecto: Llave de seguridad o biometría\..*el otro método configurado/);
  });

  it('suggests a second method when there is only one', () => {
    expect(methodSummary({ method: 'totp', appConfigured: true, keyConfigured: false, trustedDevices: 0 })).toMatch(/Configura también el otro método/);
  });
});
