import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

// The back office signs in through Keycloak's own page (authorization code with PKCE), as the client "admin-console".
// That client is bound to a sign-in flow that demands the second factor, and it is the only one the API's administration
// accepts. The session lives in the tab (sessionStorage): closing it signs out.

// Served over HTTPS (`npm run dev:https`) the dev server proxies Keycloak, so it is reached on the same origin, and the
// endpoints are set here because the discovery document would advertise plain-HTTP addresses.
const proxiedByHttpsDevServer = !import.meta.env.VITE_OIDC_AUTHORITY && window.location.protocol === 'https:';
const authority =
  import.meta.env.VITE_OIDC_AUTHORITY ||
  (proxiedByHttpsDevServer ? `${window.location.origin}/realms/kuippo` : `${window.location.protocol}//${window.location.hostname}:8180/realms/kuippo`);
const openIdConnect = `${authority}/protocol/openid-connect`;

export const userManager = new UserManager({
  authority,
  ...(proxiedByHttpsDevServer && {
    metadata: {
      issuer: authority,
      authorization_endpoint: `${openIdConnect}/auth`,
      token_endpoint: `${openIdConnect}/token`,
      end_session_endpoint: `${openIdConnect}/logout`,
      jwks_uri: `${openIdConnect}/certs`,
    },
  }),
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID || 'admin-console',
  redirect_uri: window.location.origin + '/',
  post_logout_redirect_uri: window.location.origin + '/',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  automaticSilentRenew: true,
});

let starting: Promise<User | null> | undefined;

/**
 * Finishes a sign-in when Keycloak sends the browser back with a code; otherwise returns the stored session. A code
 * works once, and React runs effects twice in development: the first call is shared.
 */
export function initAuth(): Promise<User | null> {
  starting ??= start();
  return starting;
}

async function start(): Promise<User | null> {
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') && params.has('state')) {
    const user = await userManager.signinCallback();
    window.history.replaceState(null, '', '/');
    return user ?? null;
  }
  const user = await userManager.getUser();
  return user && !user.expired ? user : null;
}

export const signIn = () => userManager.signinRedirect();
export const signOut = () => userManager.signoutRedirect();
