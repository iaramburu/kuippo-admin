import type { BracketRow } from './types';

/** The same rules the API applies to a table of the RETA brackets, so a mistake is shown before it is sent. */
export function checkBrackets(rows: BracketRow[]): string | null {
  if (rows.length === 0) return 'La tabla no tiene tramos.';
  if (rows.length > 40) return 'Una tabla tiene como mucho 40 tramos.';
  for (const [i, b] of rows.entries()) {
    const label = `Tramo ${i + 1}`;
    if (![b.yieldFrom, b.minimumBase, b.maximumBase, b.monthlyQuota].every((n) => Number.isFinite(n) && n >= 0)) return `${label}: los importes no pueden estar vacíos ni ser negativos.`;
    if (i === 0 && b.yieldFrom !== 0) return 'El tramo 1 empieza en un rendimiento de 0.';
    if (i > 0 && rows[i - 1]!.yieldTo !== b.yieldFrom) return `${label}: debe empezar donde acaba el anterior.`;
    if (b.yieldTo === null && i !== rows.length - 1) return `${label}: solo el último tramo puede quedar abierto.`;
    if (b.yieldTo !== null && !(b.yieldTo > b.yieldFrom)) return `${label}: debe acabar por encima de donde empieza.`;
    if (b.minimumBase > b.maximumBase) return `${label}: la base mínima supera la máxima.`;
    if (b.monthlyQuota <= 0) return `${label}: la cuota mensual no puede ser 0.`;
  }
  if (rows[rows.length - 1]!.yieldTo !== null) return 'El último tramo debe quedar abierto (sin límite superior).';
  return null;
}

/** Numbers 1..n and every bracket starting where the previous one ends: editing "hasta" moves the next "desde". */
export function relink(rows: BracketRow[]): BracketRow[] {
  return rows.map((row, i) => ({
    ...row,
    number: i + 1,
    yieldFrom: i === 0 ? 0 : (rows[i - 1]!.yieldTo ?? row.yieldFrom),
    yieldTo: i === rows.length - 1 ? null : row.yieldTo,
  }));
}

/** A bracket added at the end: the previous last one closes at a round figure above its start, and the new one is open. */
export function addBracket(rows: BracketRow[]): BracketRow[] {
  if (rows.length === 0) return [{ number: 1, yieldFrom: 0, yieldTo: null, minimumBase: 0, maximumBase: 0, monthlyQuota: 0 }];
  const last = rows[rows.length - 1]!;
  const closed = { ...last, yieldTo: Math.ceil((last.yieldFrom + 1) / 100) * 100 + 100 };
  return relink([...rows.slice(0, -1), closed, { ...last, number: rows.length + 1, yieldFrom: closed.yieldTo, yieldTo: null }]);
}

/** The table of another year as a starting point: same figures, to be adjusted to the new official order. */
export const copyTable = (rows: BracketRow[]): BracketRow[] => rows.map((r) => ({ ...r }));
