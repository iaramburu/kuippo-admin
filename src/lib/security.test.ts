import { describe, expect, it } from 'vitest';
import { describeSession, exportFileName, lastUseText, orderSessions, passwordProblem, trustedDevicesText } from './security';
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
