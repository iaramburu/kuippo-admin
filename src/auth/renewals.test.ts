import type { User, UserManager } from 'oidc-client-ts';
import { describe, expect, it } from 'vitest';
import { serializeRenewals } from './renewals';

const user = (token: string, expired = false) => ({ access_token: token, expired }) as unknown as User;

/** A manager with the session in a variable (what localStorage is for the tabs) and a counter of the real renewals. */
function fakeManager(initial: string) {
  const state = { stored: user(initial), renewals: 0, pending: undefined as undefined | (() => void) };
  const manager = {
    getUser: async () => state.stored,
    signinSilent: async () => {
      state.renewals += 1;
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      state.stored = user(`token-${state.renewals}`);
      return state.stored;
    },
  } as unknown as UserManager;
  return { manager, state };
}

/** A lock like the browser's: one holder at a time, the others wait their turn. */
function fakeLocks() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    request: ((_name: string, callback: () => Promise<unknown>) => {
      const result = tail.then(callback);
      tail = result.catch(() => undefined);
      return result;
    }) as unknown as LockManager['request'],
  };
}

describe('serializeRenewals', () => {
  it('renews once for the calls that come at the same time', async () => {
    const { manager, state } = fakeManager('first');
    serializeRenewals(manager, fakeLocks());
    const results = await Promise.all([manager.signinSilent(), manager.signinSilent(), manager.signinSilent()]);
    expect(state.renewals).toBe(1);
    expect(new Set(results.map((r) => r?.access_token)).size).toBe(1);
  });

  it('renews again for a call that comes after', async () => {
    const { manager, state } = fakeManager('first');
    serializeRenewals(manager, fakeLocks());
    await manager.signinSilent();
    await manager.signinSilent();
    expect(state.renewals).toBe(2);
  });

  it('uses what another tab stored instead of renewing with a token that was already used', async () => {
    const { manager, state } = fakeManager('first');
    const locks = fakeLocks();
    serializeRenewals(manager, locks);
    // another tab holds the lock, renews and stores its result while this tab waits
    const other = locks.request('x', async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      state.stored = user('renewed-by-another-tab');
    });
    const mine = manager.signinSilent();
    await other;
    expect((await mine)?.access_token).toBe('renewed-by-another-tab');
    expect(state.renewals).toBe(0);
  });

  it('works without locks (a browser that has none)', async () => {
    const { manager, state } = fakeManager('first');
    serializeRenewals(manager, undefined);
    await Promise.all([manager.signinSilent(), manager.signinSilent()]);
    expect(state.renewals).toBe(1);
  });

  it('lets a failure through and renews again afterwards', async () => {
    const { manager, state } = fakeManager('first');
    let fail = true;
    const real = manager.signinSilent;
    manager.signinSilent = async (...args: Parameters<typeof real>) => {
      if (fail) throw new Error('refused');
      return real(...args);
    };
    serializeRenewals(manager, fakeLocks());
    await expect(manager.signinSilent()).rejects.toThrow('refused');
    fail = false;
    await manager.signinSilent();
    expect(state.renewals).toBe(1);
  });
});
