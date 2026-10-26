/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
}

/** Which build this is (the commit in CI); see vite.config.ts. */
declare const __APP_VERSION__: string;
