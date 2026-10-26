/**
 * Guard against a sign-in that goes round and round: the site sends the person to Keycloak, Keycloak (or what answers in its place)
 * sends them back without a session, and the site sends them again. That happens when Keycloak is not reachable through the site's
 * own address (the proxy does not serve /realms, so the site itself answers there) or when Keycloak keeps refusing.
 */
const ATTEMPTS_KEY = 'kuippo.admin.signInAttempts';
export const ATTEMPT_WINDOW_MS = 60_000;
export const MAX_ATTEMPTS = 3;

/** True when this page is being served at an address that belongs to Keycloak: the proxy that should lead there does not. */
export function servedAtKeycloakAddress(pathname: string): boolean {
  return /^\/(realms|resources)(\/|$)/.test(pathname);
}

/** The attempts that still count (made within the window), with `now` added; and whether that is too many. */
export function countAttempt(previous: number[], now: number): { attempts: number[]; tooMany: boolean } {
  const attempts = [...previous.filter((at) => now - at < ATTEMPT_WINDOW_MS && at <= now), now];
  return { attempts, tooMany: attempts.length > MAX_ATTEMPTS };
}

/**
 * Whether the site may send the person to Keycloak by itself now. It records the attempt; a page served at a Keycloak address, or
 * more attempts than MAX_ATTEMPTS within a minute, say no (the person can still press the button to try once more).
 */
export function mayRedirectToKeycloak(now = Date.now()): boolean {
  if (servedAtKeycloakAddress(window.location.pathname)) return false;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(ATTEMPTS_KEY) ?? '[]') as unknown;
    const previous = Array.isArray(stored) ? stored.filter((n): n is number => typeof n === 'number') : [];
    const { attempts, tooMany } = countAttempt(previous, now);
    window.sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    return !tooMany;
  } catch {
    return true; // without storage nothing can be counted: the page behaves as before
  }
}

export const SIGN_IN_STUCK_MESSAGE =
  'El acceso no responde en esta dirección: se te enviaba a Keycloak una y otra vez. Avisa a quien administra el servidor.';
