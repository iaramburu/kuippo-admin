# Kuippo back office

La administración de Kuippo: usuarios, tablas de cotización de la Seguridad Social, calendario fiscal, límites de uso,
interruptores de funciones, textos de los correos y el historial de cambios. Es una web estática (React 19, Vite, Tailwind 4)
que Caddy sirve en su propia dirección (`admin.kuippo.com`), separada de la app de los clientes. No tiene backend propio: usa
`/api/v1/admin/**` de `kuippo-backend`.

El acceso es con contraseña **y** código de la aplicación de autenticación (cliente `admin-console` de Keycloak) y solo para
cuentas con el rol `admin`. Detalles de seguridad y de lo que se administra en `CLAUDE.md`; puesta en marcha en el servidor en
`kuippo-backend/deploy/README.md` (sección "Back office").

## Desarrollo

```
npm install
npm run dev        # http://localhost:5174
npm test
npm run build
```

Necesita el stack local (`docker compose up -d` y el backend en el puerto 8080) y el cliente en el Keycloak local:

```
KC_URL=http://localhost:8180 KC_ADMIN=admin KC_ADMIN_PASSWORD=admin ADMIN_DEV_ORIGIN=http://localhost:5174 \
  python ../kuippo-backend/deploy/admin/keycloak_setup.py admin-console
```

y una cuenta con el rol `admin` (el mismo script con `admin`, con las variables `ADMIN_*` de su cabecera). La primera vez, Keycloak
pide configurar la aplicación de autenticación.

## Despliegue

Workflow manual (`Deploy admin to VPS`, entorno PROD): despliega primero el backend y después este. Sube `dist/` a
`/srv/kuippo/admin` del servidor.
