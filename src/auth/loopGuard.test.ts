import { describe, expect, it } from 'vitest';
import { ATTEMPT_WINDOW_MS, MAX_ATTEMPTS, countAttempt, servedAtKeycloakAddress } from './loopGuard';

describe('servedAtKeycloakAddress', () => {
  it('spots the addresses that belong to Keycloak', () => {
    for (const path of ['/realms/kuippo/protocol/openid-connect/auth', '/realms/kuippo', '/resources/abc/login/kuippo/css/styles.css']) {
      expect(servedAtKeycloakAddress(path)).toBe(true);
    }
  });

  it('leaves the screens of the site alone', () => {
    for (const path of ['/', '/login', '/account', '/realmsx', '/resourcesx/a', '/users']) expect(servedAtKeycloakAddress(path)).toBe(false);
  });
});

describe('countAttempt', () => {
  it('lets a few attempts through and stops the next', () => {
    let attempts: number[] = [];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const counted = countAttempt(attempts, 1_000 + i * 100);
      expect(counted.tooMany).toBe(false);
      attempts = counted.attempts;
    }
    expect(countAttempt(attempts, 1_500).tooMany).toBe(true);
  });

  it('forgets the attempts of earlier than the window', () => {
    const counted = countAttempt([1_000, 1_100, 1_200], 1_000 + ATTEMPT_WINDOW_MS + 5_000);
    expect(counted.attempts).toHaveLength(1);
    expect(counted.tooMany).toBe(false);
  });
});
