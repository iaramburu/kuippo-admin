import { userManager } from '../auth/oidc';
import type {
  Account,
  AccountUpdate,
  AuditEntry,
  BracketRow,
  BracketYear,
  LoginSession,
  ManagedUser,
  ManagedUserPage,
  ManagedUserPayload,
  MfaMethod,
  Parameter,
  Security,
  AdvisorSourcesConfig,
  AdvisorTools,
  IngestionRun,
  SourceStatus,
} from './types';

// Served over HTTPS (`npm run dev:https`) the dev server proxies the API, so it is reached on the same origin.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || (window.location.protocol === 'https:' ? '/api/v1' : `${window.location.protocol}//${window.location.hostname}:8080/api/v1`);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }

  get unauthorized() {
    return this.status === 401;
  }
}

/** Called when the session cannot be renewed: the page goes back to the sign-in. */
let onSessionLost: () => void = () => undefined;
export const setSessionLostHandler = (handler: () => void) => {
  onSessionLost = handler;
};

async function toError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { detail?: string; title?: string; field?: string };
    return new ApiError(response.status, body.detail ?? body.title ?? `HTTP ${response.status}`, body.field);
  } catch {
    return new ApiError(response.status, response.statusText || `HTTP ${response.status}`);
  }
}

async function request(path: string, init: RequestInit = {}, base = API_BASE): Promise<Response> {
  const send = async (token: string | undefined) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');
    return fetch(`${base}${path}`, { ...init, headers });
  };
  let response = await send((await userManager.getUser())?.access_token);
  if (response.status === 401) {
    const renewed = await userManager.signinSilent().catch(() => null);
    // The session cannot be renewed: sign in again. When it can, and the API still refuses the new token, the session is fine
    // and the API is the problem (another issuer or client configured, an old build): say so instead of throwing the person out.
    if (!renewed) onSessionLost();
    else response = await send(renewed.access_token);
  }
  if (!response.ok) throw await toError(response);
  return response;
}

const get = async <T>(path: string) => (await (await request(path)).json()) as T;
const send = async <T>(method: string, path: string, body?: unknown) =>
  (await (await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })).json()) as T;

// ---- settings and the log
export const fetchParameters = () => get<Parameter[]>('/admin/parameters');
export const setParameter = (scope: string, key: string, value: unknown) =>
  send<Parameter>('PUT', `/admin/parameters/${scope}/${key}`, { value });
export const resetParameter = (scope: string, key: string) => send<Parameter>('DELETE', `/admin/parameters/${scope}/${key}`);
export const fetchAudit = (scope: string, before: number | null, limit = 30) =>
  get<AuditEntry[]>(`/admin/audit?limit=${limit}${scope ? `&scope=${scope}` : ''}${before ? `&before=${before}` : ''}`);
export const revertChange = (id: number) => send<AuditEntry>('POST', `/admin/audit/${id}/revert`);

// ---- social security
export const fetchBracketYears = () => get<BracketYear[]>('/admin/social-security');
export const fetchBrackets = (year: number) => get<BracketRow[]>(`/admin/social-security/${year}`);
export const saveBrackets = (year: number, rows: BracketRow[]) => send<BracketRow[]>('PUT', `/admin/social-security/${year}`, rows);
export const deleteBrackets = async (year: number) => {
  await request(`/admin/social-security/${year}`, { method: 'DELETE' });
};

// ---- users
export const fetchUsers = (search: string, page: number, size = 20) =>
  get<ManagedUserPage>(`/admin/users?page=${page}&size=${size}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
export const createUser = (payload: ManagedUserPayload) => send<ManagedUser>('POST', '/admin/users', payload);
export const updateUser = (id: string, payload: ManagedUserPayload) => send<ManagedUser>('PUT', `/admin/users/${id}`, payload);
/** Ends every session of one account: it has to sign in again on all its devices. */
export const closeUserSessions = async (id: string) => {
  await request(`/admin/users/${id}/sessions/revoke`, { method: 'POST' });
};
/** For a person who lost their phone or key: removes the authenticator app and the security keys, back to the code by e-mail. */
export const resetUserMfa = async (id: string) => {
  await request(`/admin/users/${id}/mfa/reset`, { method: 'POST' });
};
export const setUserPassword = async (id: string, newPassword: string) => {
  await request(`/admin/users/${id}/password`, { method: 'POST', body: JSON.stringify({ newPassword }) });
};

// ---- sessions
/** Ends every session of every account (the administrator's own included). */
export const revokeAllSessions = async () => {
  await request('/admin/sessions/revoke', { method: 'POST' });
};

// ---- the account of whoever is signed in (the same calls as the customers' app)
export const fetchAccount = () => get<Account>('/account');
export const updateAccount = (payload: AccountUpdate) => send<Account>('PUT', '/account', payload);
export const changePassword = async (currentPassword: string, newPassword: string) => {
  await request('/account/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
};
export const fetchSecurity = () => get<Security>('/account/security');
/** Chooses the second factor; the password is asked again. */
export const setMfaMethod = (method: MfaMethod, password: string) => send<Security>('PUT', '/account/security/method', { method, password });
export const forgetTrustedDevices = async () => {
  await request('/account/security/trusted-devices', { method: 'DELETE' });
};
export const fetchSessions = () => get<LoginSession[]>('/account/sessions');
export const closeSession = async (id: string) => {
  await request(`/account/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
};
/** Ends every session of the account, on every device. */
export const endAllSessions = async () => {
  await request('/account/sessions/end', { method: 'POST', body: '{}' });
};
/** A copy of what is stored about the account. */
export const exportAccountData = async () => (await request('/account/export')).blob();

// ---- two-step verification
/** Whether the second factor is asked at the sign-ins of the customers' app (the administration's is always on). */
export const fetchTwoStep = async () => (await get<{ twoStep: boolean }>('/admin/security')).twoStep;
/** Switches it on or off for the app (off: the password is enough there, for when the e-mail with the code does not arrive). */
export const setTwoStep = async (twoStep: boolean) => (await send<{ twoStep: boolean }>('PUT', '/admin/security', { twoStep })).twoStep;

// ---- geography (public)
export const fetchProvinces = async () => (await (await fetch(`${API_BASE}/geo/provinces`)).json()) as { code: string; name: string }[];
export const fetchMunicipalities = async (code: string) =>
  (await (await fetch(`${API_BASE}/geo/provinces/${code}/municipalities`)).json()) as string[];

// ---- the advisor: its own service, which only a local installation lets this site manage
// (over HTTPS the dev server proxies it on the same origin; plain HTTP calls the service's port)
const ADVISOR_BASE =
  import.meta.env.VITE_ADVISOR_BASE_URL || (window.location.protocol === 'https:' ? '/api/v1' : `${window.location.protocol}//${window.location.hostname}:8090/api/v1`);

const advisorGet = async <T>(path: string) => (await (await request(path, {}, ADVISOR_BASE)).json()) as T;
const advisorSend = async <T>(method: string, path: string, body?: unknown) =>
  (await (await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, ADVISOR_BASE)).json()) as T;

export const fetchAdvisorTools = () => advisorGet<AdvisorTools>('/admin/advisor');
export const saveAdvisorSources = (config: AdvisorSourcesConfig) => advisorSend<AdvisorTools>('PUT', '/admin/advisor/sources', config);
export const resetAdvisorSources = () => advisorSend<AdvisorTools>('DELETE', '/admin/advisor/sources');
export const fetchSourceStatus = () => advisorGet<SourceStatus[]>('/advisor/sources');
export const fetchIngestionRuns = () => advisorGet<IngestionRun[]>('/admin/ingestion/runs');
/** Reads the sources (all, or the ids given) and creates their vectors; runs in the background. */
export const startIngestion = (sourceIds: string[], force: boolean) => advisorSend<IngestionRun>('POST', '/admin/ingestion/runs', { sourceIds, force });
