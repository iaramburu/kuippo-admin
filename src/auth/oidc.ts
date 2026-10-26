import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

// The back office signs in through Keycloak's own page (authorization code with PKCE), as the client "admin-console".
// That client is bound to a sign-in flow that demands the second factor, and it is the only one the API's administration
// accepts. The session is kept in the browser (localStorage) and renewed with the refresh token while Keycloak's session lives: 30
// minutes without use, or a year when the person ticked "I trust this device" on Keycloak's page.

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
  userStore: new WebStorageStateStore({ store: window.localStorage }),
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
    try {
      return (await userManager.signinCallback()) ?? null;
    } catch (failure) {
      // The Back button of the browser can land on the address of an earlier sign-in, whose code was already used: when there is a
      // session the sign-in is done and nothing is wrong
      const signedIn = await userManager.getUser();
      if (signedIn && !signedIn.expired) return signedIn;
      throw failure;
    } finally {
      window.history.replaceState(null, '', '/');
    }
  }
  const user = await userManager.getUser();
  return user && !user.expired ? user : null;
}

export const signIn = () => userManager.signinRedirect();
/**
 * Ends the session on the server (the refresh token goes to Keycloak's logout endpoint in the background, so no address has to be
 * allowed for it and no page of Keycloak is shown) and here, then starts again at the site, which leads to the sign-in.
 */
export async function signOut(): Promise<void> {
  const user = await userManager.getUser();
  try {
    const { end_session_endpoint } = await userManager.metadataService.getMetadata();
    if (user?.refresh_token && end_session_endpoint) {
      await fetch(end_session_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: userManager.settings.client_id, refresh_token: user.refresh_token }),
      });
    }
  } catch (failure) {
    // the local session is removed regardless
    console.warn('Sign-out: the session could not be ended on the server', failure);
  }
  await userManager.removeUser();
  window.location.assign('/');
}
