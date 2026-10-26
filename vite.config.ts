import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// `npm run dev:https` (mode "https") serves the site over HTTPS with a throw-away certificate and proxies the API and Keycloak
// through the same origin: an HTTPS page may not call plain-HTTP services, and this lets the site be tried from another
// device (a phone) at https://<pc-ip>:5174. The proxy tells Keycloak the page is HTTPS (xfwd; the development Keycloak is
// started with KC_PROXY_HEADERS=xforwarded) so the sign-in page it builds points back at this address.
const BACKEND = process.env.KUIPPO_BACKEND_URL ?? 'http://localhost:8080';
const KEYCLOAK = process.env.KUIPPO_KEYCLOAK_URL ?? 'http://localhost:8180';

export default defineConfig(({ mode }) => ({
  plugins: [...(mode === 'https' ? [basicSsl()] : []), react(), tailwindcss()],
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
