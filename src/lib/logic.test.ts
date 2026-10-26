import { describe, expect, it } from 'vitest';
import { rolesOf, isAdmin } from '../auth/claims';
import { describeEntry, summarize } from './audit';
import { addBracket, checkBrackets, relink } from './brackets';
import { checkRules, newRule, previewDeadlines } from './calendar';
import { checkRate, describeRate, joinEvery, splitEvery } from './rates';
import type { AuditEntry, BracketRow, CalendarRule } from './types';

const row = (number: number, from: number, to: number | null): BracketRow => ({ number, yieldFrom: from, yieldTo: to, minimumBase: 700, maximumBase: 900, monthlyQuota: 200 });

describe('rates', () => {
  it('shows a time in the unit that reads best and converts back', () => {
    expect(splitEvery(6000)).toEqual({ amount: 6, unit: 's' });
    expect(splitEvery(360_000)).toEqual({ amount: 6, unit: 'min' });
    expect(splitEvery(250)).toEqual({ amount: 250, unit: 'ms' });
    expect(splitEvery(3_600_000)).toEqual({ amount: 1, unit: 'h' });
    expect(joinEvery(6, 's')).toBe(6000);
    expect(joinEvery(1.5, 'min')).toBe(90_000);
  });
  it('says what a limit means', () => {
    expect(describeRate({ everyMs: 25, burst: 100 })).toBe('40 por segundo de forma sostenida, con ráfagas de hasta 100');
    expect(describeRate({ everyMs: 6000, burst: 10 })).toBe('10 por minuto de forma sostenida, con ráfagas de hasta 10');
    expect(describeRate({ everyMs: 360_000, burst: 10 })).toContain('por hora');
  });
  it('refuses what the API would refuse', () => {
    expect(checkRate({ everyMs: 25, burst: 100 })).toBeNull();
    expect(checkRate({ everyMs: 5, burst: 100 })).not.toBeNull();
    expect(checkRate({ everyMs: 7_200_000, burst: 100 })).not.toBeNull();
    expect(checkRate({ everyMs: 100, burst: 0 })).not.toBeNull();
    expect(checkRate({ everyMs: 100, burst: 1.5 })).not.toBeNull();
    expect(checkRate({ everyMs: NaN, burst: 1 })).not.toBeNull();
  });
});

describe('brackets', () => {
  it('accepts a contiguous table that is open at the top', () => {
    expect(checkBrackets([row(1, 0, 700), row(2, 700, 1000), row(3, 1000, null)])).toBeNull();
  });
  it('explains what is wrong', () => {
    expect(checkBrackets([])).toMatch(/no tiene tramos/);
    expect(checkBrackets([row(1, 10, null)])).toMatch(/empieza en un rendimiento de 0/);
    expect(checkBrackets([row(1, 0, 700), row(2, 750, null)])).toMatch(/donde acaba el anterior/);
    expect(checkBrackets([row(1, 0, null), row(2, 0, null)])).toMatch(/solo el último/);
    expect(checkBrackets([row(1, 0, 700)])).toMatch(/abierto/);
    expect(checkBrackets([{ ...row(1, 0, null), minimumBase: 1000 }])).toMatch(/base mínima/);
    expect(checkBrackets([{ ...row(1, 0, null), monthlyQuota: 0 }])).toMatch(/cuota/);
    expect(checkBrackets([{ ...row(1, 0, null), monthlyQuota: NaN }])).toMatch(/importes/);
  });
  it('relinks the rows when an upper limit changes', () => {
    const rows = relink([row(1, 0, 800), row(2, 700, 1000), row(3, 1000, 5)]);
    expect(rows.map((r) => [r.number, r.yieldFrom, r.yieldTo])).toEqual([[1, 0, 800], [2, 800, 1000], [3, 1000, null]]);
  });
  it('adds an open bracket after closing the last one', () => {
    const rows = addBracket([row(1, 0, 700), row(2, 700, null)]);
    expect(rows).toHaveLength(3);
    expect(rows[1]!.yieldTo).toBeGreaterThan(700);
    expect(rows[2]).toMatchObject({ number: 3, yieldFrom: rows[1]!.yieldTo, yieldTo: null });
    expect(checkBrackets(rows)).toBeNull();
    expect(addBracket([])).toHaveLength(1);
  });
});

const defaults: CalendarRule[] = [
  { id: 'Q4', models: ['303', '130', '111'], description: '{quarter}T {year}: IVA, IRPF y retenciones', quarter: 4, periodYearOffset: -1, month: 1, day: 30 },
  { id: 'M190', models: ['190'], description: 'Resumen anual de retenciones {year}', quarter: 0, periodYearOffset: -1, month: 1, day: 31 },
  { id: 'Q1', models: ['303', '130', '111'], description: '{quarter}T {year}: IVA, IRPF y retenciones', quarter: 1, periodYearOffset: 0, month: 4, day: 20 },
];

describe('calendar', () => {
  it('lists the deadlines of a year by date, moving weekends to Monday', () => {
    const list = previewDeadlines(defaults, 2026);
    expect(list.map((d) => [d.id, d.due])).toEqual([['Q4-2025', '2026-01-30'], ['M190-2025', '2026-02-02'], ['Q1-2026', '2026-04-20']]);
    expect(list[0]!.description).toBe('4T 2025: IVA, IRPF y retenciones');
    expect(list[1]!.description).toBe('Resumen anual de retenciones 2025');
  });
  it('checks the rules like the API', () => {
    expect(checkRules(defaults)).toBeNull();
    expect(checkRules([])).not.toBeNull();
    expect(checkRules([{ ...defaults[0]!, id: 'a b' }])).not.toBeNull();
    expect(checkRules([defaults[0]!, defaults[0]!])).toMatch(/repetido/);
    expect(checkRules([{ ...defaults[0]!, month: 4, day: 31 }])).toMatch(/no existe/);
    expect(checkRules([{ ...defaults[0]!, month: 2, day: 29 }])).toBeNull();
    expect(checkRules([{ ...defaults[0]!, models: [] }])).not.toBeNull();
    expect(checkRules([newRule(1)])).toBeNull();
  });
});

describe('audit and claims', () => {
  const entry: AuditEntry = { id: 1, at: '2026-10-26T10:00:00Z', actorEmail: 'ana@kuippo.com', action: 'set', scope: 'limits', key: 'api', before: null, after: { everyMs: 50, burst: 20 }, revertible: true };
  it('writes the entry in words', () => {
    const parameters = [{ scope: 'limits', key: 'api', title: 'Uso general de la API' }] as never;
    expect(describeEntry(entry, parameters)).toBe('ana@kuippo.com cambió Límites · Uso general de la API');
    expect(describeEntry({ ...entry, scope: 'social-security', key: '2027' }, [])).toBe('ana@kuippo.com cambió Seguridad Social · tabla de 2027');
    expect(describeEntry({ ...entry, scope: 'users', action: 'password' }, [])).toBe('ana@kuippo.com cambió la contraseña de una cuenta');
  });
  it('says who closed every session', () => {
    const revoked = { ...entry, action: 'revoke-sessions', scope: 'security', key: 'revoked-before' };
    expect(describeEntry(revoked, [])).toBe('ana@kuippo.com cerró todas las sesiones');
  });
  it('says who switched the second factor off or on', () => {
    const off = { ...entry, action: 'two-step', scope: 'security', key: 'two-step', before: true, after: false };
    expect(describeEntry(off, [])).toBe('ana@kuippo.com desactivó la verificación en dos pasos de todas las cuentas');
    expect(describeEntry({ ...off, before: false, after: true }, [])).toBe('ana@kuippo.com activó la verificación en dos pasos de todas las cuentas');
  });
  it('says whose sessions were closed', () => {
    const one = { ...entry, action: 'revoke-sessions', scope: 'users', key: 'some-id' };
    expect(describeEntry(one, [])).toBe('ana@kuippo.com cerró las sesiones de una cuenta');
  });
  it('summarizes values', () => {
    expect(summarize(null)).toMatch(/por defecto/);
    expect(summarize([1, 2, 3])).toBe('3 elementos');
    expect(summarize({ a: 1 })).toBe('{"a":1}');
    expect(summarize(true)).toBe('true');
  });
  it('reads the roles from the token', () => {
    const payload = btoa(JSON.stringify({ realm_access: { roles: ['admin'] } })).replace(/=/g, '');
    expect(rolesOf(`x.${payload}.y`)).toEqual(['admin']);
    expect(isAdmin(`x.${payload}.y`)).toBe(true);
    expect(isAdmin('nonsense')).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});
