import type { AuditEntry, Parameter } from './types';

const ACTIONS: Record<string, string> = {
  set: 'cambió',
  reset: 'restauró el valor por defecto de',
  revert: 'deshizo un cambio de',
  create: 'creó',
  update: 'modificó',
  password: 'cambió la contraseña de',
  'revoke-sessions': 'cerró todas las sesiones',
  'two-step': 'cambió la verificación en dos pasos',
};

export const SCOPES: Record<string, string> = {
  limits: 'Límites',
  flags: 'Funciones',
  calendar: 'Calendario fiscal',
  mail: 'Plantillas de correo',
  'social-security': 'Seguridad Social',
  users: 'Usuarios',
  security: 'Seguridad',
};

/** "ana@x.com cambió Límites · Uso general de la API", with the title of the setting when it is known. */
export function describeEntry(entry: AuditEntry, parameters: Parameter[]): string {
  const action = ACTIONS[entry.action] ?? entry.action;
  if (entry.action === 'revoke-sessions') return `${entry.actorEmail || 'Alguien'} ${entry.scope === 'users' ? 'cerró las sesiones de una cuenta' : action}`;
  if (entry.action === 'two-step') return `${entry.actorEmail || 'Alguien'} ${entry.after === false ? 'desactivó' : 'activó'} la verificación en dos pasos de todas las cuentas`;
  const scope = SCOPES[entry.scope] ?? entry.scope;
  let what = scope;
  if (entry.scope === 'social-security') what = `${scope} · tabla de ${entry.key}`;
  else if (entry.scope === 'users') what = 'una cuenta';
  else what = `${scope} · ${parameters.find((p) => p.scope === entry.scope && p.key === entry.key)?.title ?? entry.key}`;
  return `${entry.actorEmail || 'Alguien'} ${action} ${what}`;
}

/** A short text for what changed: the values, when they are small. */
export function summarize(value: unknown): string {
  if (value === null || value === undefined) return 'sin valor propio (el de por defecto)';
  if (Array.isArray(value)) return `${value.length} elementos`;
  if (typeof value === 'object') {
    const text = JSON.stringify(value);
    return text.length > 160 ? text.slice(0, 157) + '…' : text;
  }
  return String(value);
}
