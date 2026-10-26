# Kuippo Back Office – Project Instructions

## Project Context
`kuippo-admin` is where the administrators of Kuippo manage users and the settings that used to be fixed in the code. It is a
static single-page app (React 19, Vite, TypeScript, Tailwind 4) served by Caddy on its own address (`KUIPPO_ADMIN_HOST`, for
example `admin.kuippo.com`), apart from the customers' app (`kuippo-frontend`). It has no backend of its own: it calls the
`/api/v1/admin/**` endpoints of `kuippo-backend`.

## Security model (do not weaken it)
- It signs in through Keycloak as the public client **`admin-console`** (authorization code with PKCE, no password grant). That
  client is bound to the flow `browser-otp-required`, so the second factor is mandatory. Created by
  `kuippo-backend/deploy/admin/keycloak-setup.sh admin-console` (`keycloak_setup.py admin-console`; the client needs the `basic` scope
  so the access token has `sub`).
- The API's administration only accepts tokens whose `azp` is `admin-console` (`requireClient`, `KUIPPO_ADMIN_CLIENT_ID`), and the
  role `admin`. A token the app obtained with just a password is refused there (403).
- The session lives in `localStorage` and is renewed with the refresh token while Keycloak's session lives (30 minutes without use, a year if the person ticked *Confío en este dispositivo* on Keycloak's page). `AuthGate` shows nothing until there is an administrator. **Usuarios > Sesiones** closes every session of every account (`POST /admin/sessions/revoke`), the administrator's own included. Each row of **Usuarios** has "Cerrar sesiones" for one account (`POST /admin/users/{id}/sessions/revoke`).
- Caddy serves it with a strict CSP (`default-src 'none'`, `script-src 'self'`, `connect-src` only the API and Keycloak): **no inline
  scripts**, no third-party scripts or fonts. Optionally restricted by address (`ADMIN_ALLOWED_IPS`).

## Sign-in look
There is no sign-in page of our own: `AuthGate` sends whoever has no session straight to Keycloak's page (and an address such as `/login` with a session leads into the site, like in the app); it only shows a page when the sign-in fails or the account is not an administrator. Keycloak's own page looks like the customers' app sign-in. The Keycloak side is a theme,
`kuippo-backend/deploy/keycloak/theme/login` (child of `keycloak.v2`: only CSS, the logo and two message fixes), with a child for the
admin site, `theme-admin` (theme `kuippo-admin`: the same with **this site's favicon**, purple, made from `public/favicon.svg`; the app's is
teal), mounted in the Keycloak container and selected per client with the attribute `login_theme` (set by `keycloak_setup.py`: `kuippo-admin`
for `admin-console` and `grafana`, `kuippo` for the app). If `public/favicon.svg` changes, regenerate `theme-admin/login/resources/img/favicon.ico`
(Keycloak only takes `.ico`). In production Keycloak caches themes: restart the container after editing them.

## What it manages (all through `/api/v1/admin/**`)
- **Usuarios**: accounts and roles (data lives in Keycloak).
- **Seguridad Social**: the RETA bracket tables by year (`PUT /admin/social-security/{year}` replaces the whole table; the API and
  `lib/brackets.ts` apply the same checks).
- **Calendario fiscal**: the filing dates as rules (`calendar/rules`), with a preview computed by `lib/calendar.ts` (mirror of the API).
- **Límites de uso**: the rate limits (`limits/*`), applied by the API within seconds, no restart.
- **Funciones**: switches to close sign-up, password recovery or OCR (`flags/*`).
- **Plantillas de correo**: subject, HTML and text of each e-mail (`mail/*`), checked by the API before saving.
- **Historial**: the audit log of every change (who, when, before and after), with "Deshacer" for settings and tables.
A setting only stores an override of the default in the code; "restaurar" deletes it. The list of settings and their defaults comes
from the API (`GET /admin/parameters`), so adding a setting is a backend change (`cmd/kuippo/settings.go`) plus, if it needs a new
kind of editor, a page here.

## Development
- `npm install`, `npm run dev` (http://localhost:5174, strict port), `npm test`, `npm run build` (type-check + build).
- Needs the local stack (`docker compose up -d` and the backend on :8080) and the client in the local Keycloak:
  `KC_URL=http://localhost:8180 KC_ADMIN=admin KC_ADMIN_PASSWORD=admin ADMIN_DEV_ORIGIN=http://localhost:5174 python ../kuippo-backend/deploy/admin/keycloak_setup.py admin-console`
  and an account with the role admin (`... keycloak_setup.py admin`, with the `ADMIN_*` variables). The first sign-in asks to set up
  an authenticator app.
- `npm run dev:https` serves it over HTTPS (throw-away certificate) and proxies `/api`, `/realms` and `/resources` on the same origin, to try it
  from a phone: see README (needs `KUIPPO_JWT_ANY_ISSUER_HOST=true` in the backend, `KC_PROXY_HEADERS=xforwarded` in the dev Keycloak and
  the `https://<ip>:5174` address in `ADMIN_DEV_ORIGIN`). `auth/oidc.ts` and `lib/api.ts` switch to same-origin when the page is HTTPS.
- `VITE_API_BASE_URL` and `VITE_OIDC_AUTHORITY` default to the same host on ports 8080 and 8180 (production builds set them).
- The deploy workflow is manual (`workflow_dispatch`): backend first, then this.

## Conventions
- Spanish text for people; English code and comments. Pages are components rendered by `App` (never call a page as a function:
  its hooks would become the app's).
- Show 0/1 as words, amounts with `Intl.NumberFormat('es-ES', { useGrouping: 'always' })`.
