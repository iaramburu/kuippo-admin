export type ParameterKind = 'rate' | 'flag' | 'calendar' | 'mail';

export interface Parameter {
  scope: string;
  key: string;
  title: string;
  description: string;
  kind: ParameterKind;
  default: unknown;
  value: unknown;
  overridden: boolean;
  updatedAt: string | null;
  updatedBy: string;
}

export interface RateValue {
  everyMs: number;
  burst: number;
}

export interface CalendarRule {
  id: string;
  models: string[];
  description: string;
  quarter: number;
  periodYearOffset: number;
  month: number;
  day: number;
}

export interface MailText {
  subject: string;
  html: string;
  text: string;
}

export interface BracketRow {
  number: number;
  yieldFrom: number;
  yieldTo: number | null;
  minimumBase: number;
  maximumBase: number;
  monthlyQuota: number;
}

export interface BracketYear {
  year: number;
  count: number;
}

export interface AuditEntry {
  id: number;
  at: string;
  actorEmail: string;
  action: string;
  scope: string;
  key: string;
  before: unknown;
  after: unknown;
  revertible: boolean;
}

export interface ManagedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  address: string;
  postalCode: string;
  provinceCode: string | null;
  province: string;
  locality: string;
  phone: string;
  country: string;
  enabled: boolean;
  roles: string[];
  createdAt: string;
}

export interface ManagedUserPage {
  users: ManagedUser[];
  total: number;
}

export interface ManagedUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  address: string;
  postalCode: string;
  provinceCode: string;
  locality: string;
  phone: string;
  roles: string[];
  enabled: boolean;
  password?: string;
}

/** The signed-in account's own data (the same one the customers' app shows). */
export interface Account {
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  address: string;
  postalCode: string;
  provinceCode: string | null;
  province: string;
  locality: string;
  phone: string;
  country: string;
}

export interface AccountUpdate {
  firstName: string;
  lastName: string;
  address: string;
  postalCode: string;
  provinceCode: string;
  locality: string;
  phone: string;
}

/** The second factor asked at a sign-in on a device that is not trusted. */
export type MfaMethod = 'email' | 'totp' | 'webauthn';

export interface Security {
  method: MfaMethod;
  appConfigured: boolean;
  keyConfigured: boolean;
  trustedDevices: number;
}

/** A sign-in that is open on some device. */
export interface LoginSession {
  id: string;
  ip: string;
  startedAt: string;
  lastAccess: string;
  clients: string[];
  /** The session of the device that asks. */
  current: boolean;
}
