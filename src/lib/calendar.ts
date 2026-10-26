import type { CalendarRule } from './types';

export interface Deadline {
  id: string;
  description: string;
  models: string[];
  /** yyyy-mm-dd, already moved to Monday when it falls on a weekend (the same rule as the API's). */
  due: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function workingDay(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay(); // 0 Sunday, 6 Saturday
  if (weekday === 6) date.setUTCDate(date.getUTCDate() + 2);
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The deadlines the rules give in a year, by date: what the API will serve to the app. */
export function previewDeadlines(rules: CalendarRule[], year: number): Deadline[] {
  return rules
    .map((r) => {
      const periodYear = year + r.periodYearOffset;
      return {
        id: `${r.id}-${periodYear}`,
        description: r.description.replaceAll('{quarter}', r.quarter > 0 ? String(r.quarter) : '').replaceAll('{year}', String(periodYear)),
        models: r.models,
        due: workingDay(year, r.month, r.day),
      };
    })
    .sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
}

const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** The same checks as the API's. */
export function checkRules(rules: CalendarRule[]): string | null {
  if (rules.length === 0) return 'El calendario necesita al menos una fecha.';
  if (rules.length > 60) return 'El calendario tiene como mucho 60 fechas.';
  const seen = new Set<string>();
  for (const [i, r] of rules.entries()) {
    const label = `Fecha ${i + 1}`;
    const id = r.id.trim();
    if (!id || id.length > 20 || /[ /?#]/.test(id)) return `${label}: el identificador tiene de 1 a 20 caracteres, sin espacios.`;
    if (seen.has(id)) return `${label}: el identificador ${id} está repetido.`;
    if (r.models.length === 0 || r.models.length > 10 || r.models.some((m) => !m.trim() || m.length > 10)) return `${label}: indica de 1 a 10 modelos.`;
    if (!r.description.trim() || r.description.length > 200) return `${label}: la descripción tiene de 1 a 200 caracteres.`;
    if (!Number.isInteger(r.month) || r.month < 1 || r.month > 12) return `${label}: el mes va de 1 a 12.`;
    if (!Number.isInteger(r.day) || r.day < 1 || r.day > DAYS[r.month - 1]!) return `${label}: ese día no existe en el mes.`;
    seen.add(id);
  }
  return null;
}

export const newRule = (n: number): CalendarRule => ({ id: `F${n}`, models: ['303'], description: '{quarter}T {year}', quarter: 1, periodYearOffset: 0, month: 4, day: 20 });
