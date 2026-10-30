import type { AdvisorSource, AdvisorSourcesConfig, IngestionRun, RunOutcome, SourceKind } from './types';

export const KINDS: { id: SourceKind; label: string }[] = [
  { id: 'boe-xml', label: 'Ley del BOE (texto consolidado)' },
  { id: 'html', label: 'Página web' },
  { id: 'pdf', label: 'Documento PDF' },
];

const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const BOE_ID = /^BOE-[A-Z]-\d{4}-\d{1,6}$/;
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

export const blankSource = (): AdvisorSource => ({ id: '', name: '', authority: '', kind: 'html', url: '', topics: [], refreshDays: 7 });

/** The topics as the person types them: separated by commas. */
export const topicsText = (topics: string[]) => topics.join(', ');
export const parseTopics = (text: string) =>
  text
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');

/** Hosts as the person types them: one per line or separated by commas; an address is reduced to its host. */
export function parseHosts(text: string): string[] {
  const hosts: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    const entry = raw.trim().toLowerCase();
    if (!entry) continue;
    let host = entry;
    try {
      if (entry.includes('/')) host = new URL(entry.includes('://') ? entry : `https://${entry}`).hostname;
    } catch {
      // left as typed: checkSources says what is wrong with it
    }
    if (!hosts.includes(host)) hosts.push(host);
  }
  return hosts;
}

/** What the advisor would refuse, said before sending (the advisor checks it again). Null when the list is fine. */
export function checkSources(config: AdvisorSourcesConfig): string | null {
  const hosts = config.allowedHosts.map((h) => h.trim().toLowerCase()).filter((h) => h !== '');
  if (hosts.length === 0) return 'Indica al menos un sitio web del que el asesor pueda leer.';
  const wrongHost = hosts.find((h) => !HOST.test(h));
  if (wrongHost) return `«${wrongHost}» no es un nombre de sitio web válido (por ejemplo, www.boe.es).`;
  if (config.sources.length === 0) return 'Añade al menos una fuente.';
  const seen = new Set<string>();
  for (const source of config.sources) {
    const label = source.id || 'una fuente sin identificador';
    if (!ID.test(source.id)) return `El identificador «${source.id}» no vale: usa minúsculas, números y guiones (de 2 a 64 caracteres).`;
    if (seen.has(source.id)) return `El identificador «${source.id}» está repetido.`;
    seen.add(source.id);
    if (!source.name.trim()) return `Falta el nombre de ${label}.`;
    if (!source.authority.trim()) return `Falta el organismo de ${label}.`;
    if (!Number.isInteger(source.refreshDays) || source.refreshDays < 1 || source.refreshDays > 365) {
      return `Los días entre lecturas de ${label} deben estar entre 1 y 365.`;
    }
    if (source.kind === 'boe-xml') {
      if (!BOE_ID.test((source.boeId ?? '').trim())) return `El identificador del BOE de ${label} no es válido (por ejemplo, BOE-A-1992-28740).`;
      if (!hosts.includes('www.boe.es')) return `Para leer del BOE, www.boe.es tiene que estar entre los sitios permitidos (${label}).`;
    } else {
      let url: URL | null = null;
      try {
        url = new URL((source.url ?? '').trim());
      } catch {
        url = null;
      }
      if (!url || url.protocol !== 'https:' || url.username !== '') return `La dirección de ${label} debe empezar por https://.`;
      if (!hosts.includes(url.hostname.toLowerCase())) return `La dirección de ${label} es de ${url.hostname}, que no está entre los sitios permitidos.`;
    }
  }
  return null;
}

/** What goes to the advisor: trimmed, and each kind with only its own address field. */
export function cleanConfig(config: AdvisorSourcesConfig): AdvisorSourcesConfig {
  return {
    allowedHosts: parseHosts(config.allowedHosts.join(',')),
    sources: config.sources.map((s) => ({
      id: s.id.trim(),
      name: s.name.trim(),
      authority: s.authority.trim(),
      kind: s.kind,
      ...(s.kind === 'boe-xml' ? { boeId: (s.boeId ?? '').trim() } : { url: (s.url ?? '').trim() }),
      topics: s.topics,
      refreshDays: s.refreshDays,
    })),
  };
}

export const sameConfig = (a: AdvisorSourcesConfig, b: AdvisorSourcesConfig) => JSON.stringify(cleanConfig(a)) === JSON.stringify(cleanConfig(b));

const number = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });
export const formatCount = (n: number) => number.format(n);

const OUTCOME_TEXT: Record<RunOutcome, string> = {
  ADDED: 'añadida',
  UPDATED: 'actualizada',
  UNCHANGED: 'sin cambios',
  FAILED: 'con error',
};
export const outcomeText = (outcome: RunOutcome) => OUTCOME_TEXT[outcome];

/** A run in one sentence: what is being done or what came out. */
export function describeRun(run: IngestionRun): string {
  const count = (o: RunOutcome) => run.results.filter((r) => r.outcome === o).length;
  const chunks = run.results.reduce((sum, r) => sum + r.chunks, 0);
  if (run.status === 'RUNNING') {
    return run.results.length === 0 ? 'Leyendo las fuentes y creando los vectores…' : `Leyendo las fuentes y creando los vectores… (${run.results.length} hechas)`;
  }
  const parts = [
    count('ADDED') && `${count('ADDED')} añadidas`,
    count('UPDATED') && `${count('UPDATED')} actualizadas`,
    count('UNCHANGED') && `${count('UNCHANGED')} sin cambios`,
    count('FAILED') && `${count('FAILED')} con error`,
  ].filter(Boolean);
  const summary = parts.length === 0 ? 'Sin fuentes' : parts.join(', ');
  return chunks > 0 ? `${summary} · ${formatCount(chunks)} fragmentos indexados` : summary;
}
