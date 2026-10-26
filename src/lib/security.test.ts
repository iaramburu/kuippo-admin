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
    expect(passwordProblem('', 'abcdefgh', 'abcdefgh')).toMatch(/actual/);
    expect(passwordProblem('old-password', 'short', 'short')).toMatch(/8 caracteres/);
    expect(passwordProblem('old-password', 'old-password', 'old-password')).toMatch(/distinta/);
    expect(passwordProblem('old-password', 'new-password', 'other-password')).toMatch(/no coinciden/);
    expect(passwordProblem('old-password', 'new-password', 'new-password')).toBeNull();
  });
});

describe('methodStates', () => {
  const only = { method: 'email', appConfigured: false, keyConfigured: false, trustedDevices: 0 } as const;
  const state = (security: Parameters<typeof methodStates>[0], id: string) => methodStates(security).find((s) => s.id === id)!;

  it('the e-mail is always set up and, by default, the one in use', () => {
    const email = state(only, 'email');
    expect(email.configured).toBe(true);
    expect(email.isDefault).toBe(true);
    expect(email.usage).toMatch(/^En uso/);
  });

  it('says which are not set up', () => {
    expect(state(only, 'totp').configured).toBe(false);
    expect(state(only, 'webauthn').configured).toBe(false);
    expect(state(only, 'totp').usage).toMatch(/hasta que lo configures/);
  });

  it('says which can be chosen instead and which one is in use', () => {
    const all = { method: 'webauthn', appConfigured: true, keyConfigured: true, trustedDevices: 1 } as const;
    expect(methodStates(all).filter((s) => s.isDefault).map((s) => s.id)).toEqual(['webauthn']);
    expect(state(all, 'email').usage).toMatch(/lo puedes elegir en la pantalla de verificación/);
    expect(state(all, 'totp').configured).toBe(true);
    expect(state(all, 'totp').isDefault).toBe(false);
  });
});

describe('methodSummary', () => {
  it('names the default and the way out', () => {
    expect(methodSummary({ method: 'email', appConfigured: false, keyConfigured: false, trustedDevices: 0 })).toMatch(/Configura otro método/);
    expect(methodSummary({ method: 'totp', appConfigured: true, keyConfigured: false, trustedDevices: 0 })).toMatch(/Método por defecto: App de autenticación\..*el otro método configurado/);
    expect(methodSummary({ method: 'email', appConfigured: true, keyConfigured: true, trustedDevices: 0 })).toMatch(/otro de los métodos configurados/);
  });
});
