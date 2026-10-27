import type { User, UserManager } from 'oidc-client-ts';

// A refresh token works once: Keycloak gives a new one with every renewal and, if an old one is used again, ends the whole session
// (a stolen refresh token that could be reused would be a session of its own). So two renewals must never use the same token:
//  - in one page, the calls that come at the same time (the timer before the token expires, and the requests that got a 401) share one;
//  - between tabs, which share the session stored in the browser, a lock makes the second wait for the first and, if the first already
//    renewed (the stored token is no longer the one this tab had), use what it stored instead of renewing again.

const LOCK = 'kuippo-admin-token-renewal';

type Locks = Pick<LockManager, 'request'> | undefined;

/** Makes manager.signinSilent (which the automatic renewal of oidc-client-ts calls too) renew once at a time. */
export function serializeRenewals(manager: UserManager, locks: Locks = typeof navigator === 'undefined' ? undefined : navigator.locks): void {
  const original = manager.signinSilent.bind(manager);
  let inflight: Promise<User | null> | undefined;

  const run = async (args?: Parameters<UserManager['signinSilent']>[0]): Promise<User | null> => {
    const before = (await manager.getUser())?.access_token;
    const renew = async (): Promise<User | null> => {
      const stored = await manager.getUser();
      if (stored && before && stored.access_token !== before && !stored.expired) return stored; // another tab renewed meanwhile
      return original(args);
    };
    return locks ? locks.request(LOCK, renew) : renew();
  };

  manager.signinSilent = (args) => {
    inflight ??= run(args).finally(() => {
      inflight = undefined;
    });
    return inflight;
  };
}
