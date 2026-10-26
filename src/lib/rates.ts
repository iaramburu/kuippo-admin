import type { RateValue } from './types';

export type Unit = 'ms' | 's' | 'min' | 'h';
const MS: Record<Unit, number> = { ms: 1, s: 1000, min: 60_000, h: 3_600_000 };

/** A time between requests in the unit that reads best ("6 s", not "6000 ms"). */
export function splitEvery(ms: number): { amount: number; unit: Unit } {
  for (const unit of ['h', 'min', 's'] as const) {
    if (ms >= MS[unit] && ms % MS[unit] === 0) return { amount: ms / MS[unit], unit };
  }
  return { amount: ms, unit: 'ms' };
}

export const joinEvery = (amount: number, unit: Unit) => Math.round(amount * MS[unit]);

/** What a limit means in words: the sustained pace and how many may come at once. */
export function describeRate({ everyMs, burst }: RateValue): string {
  const perHour = 3_600_000 / everyMs;
  const pace =
    perHour >= 3600 * 2 ? `${Math.round(1000 / everyMs)} por segundo` : perHour >= 120 ? `${Math.round(60_000 / everyMs)} por minuto` : `${Math.round(perHour * 10) / 10} por hora`;
  return `${pace} de forma sostenida, con ráfagas de hasta ${burst}`;
}

/** The same checks as the API's, so a mistake is shown before it is sent. */
export function checkRate({ everyMs, burst }: RateValue): string | null {
  if (!Number.isFinite(everyMs) || everyMs < 10 || everyMs > 3_600_000) return 'El tiempo entre peticiones va de 10 ms a 1 hora.';
  if (!Number.isInteger(burst) || burst < 1 || burst > 100_000) return 'La ráfaga va de 1 a 100000 peticiones.';
  return null;
}
