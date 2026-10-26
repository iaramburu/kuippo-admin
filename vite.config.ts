import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Which build this is: the commit in CI (so the same code is the same version), the moment of the build otherwise. */
function buildVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() + (process.env.CI ? '' : `-${Date.now().toString(36)}`);
  } catch {
    return `build-${Date.now().toString(36)}`;
  }
}
const VERSION = buildVersion();

/**
 * Writes /version.json: the version of this build. The open site reads it (a few bytes, never cached) to learn that a newer
 * deployment exists, and reloads itself (lib/autoUpdate.ts).
 */
function versionFile(): Plugin {
  return {
    name: 'kuippo-version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) });
    },
  };
}

// `npm run dev:https` (mode "https") serves the site over HTTPS with a throw-away certificate and proxies the API and Keycloak
// through the same origin: an HTTPS page may not call plain-HTTP services, and this lets the site be tried from another
// device (a phone) at https://<pc-ip>:5174. The proxy tells Keycloak the page is HTTPS (xfwd; the development Keycloak is
// started with KC_PROXY_HEADERS=xforwarded) so the sign-in page it builds points back at this address.
const BACKEND = process.env.KUIPPO_BACKEND_URL ?? 'http://localhost:8080';
const KEYCLOAK = process.env.KUIPPO_KEYCLOAK_URL ?? 'http://localhost:8180';

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [...(mode === 'https' ? [basicSsl()] : []), react(), tailwindcss(), versionFile()],
  server: {
    port: 5174,
    // (development names that point to this PC through the hosts file, e.g. app.kuippo.local and admin.kuippo.local: with
    // their own host each site has its own Keycloak session, so two accounts can be signed in at once)
    allowedHosts: ['.kuippo.local'],
    strictPort: true,
    proxy: {
      // Same-origin from the browser's point of view: drop `Origin` so the backend's CORS filter does not reject the
      // page's own LAN address (https://<ip>:5174) as a foreign origin.
      '/api': {
        target: BACKEND,
        configure: (proxy) => proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin')),
      },
      '/realms': { target: KEYCLOAK, xfwd: true },
      '/resources': { target: KEYCLOAK, xfwd: true },
    },
  },
  build: { sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
