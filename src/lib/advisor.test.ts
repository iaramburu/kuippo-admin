import { describe, expect, it } from 'vitest';
import { blankSource, checkSources, cleanConfig, describeRun, parseHosts, parseTopics, sameConfig } from './advisor';
import type { AdvisorSourcesConfig, IngestionRun } from './types';

const boe = { id: 'boe-iva', name: 'Ley del IVA', authority: 'BOE', kind: 'boe-xml' as const, boeId: 'BOE-A-1992-28740', topics: ['iva'], refreshDays: 7 };
const page = { id: 'aeat-irpf', name: 'IRPF', authority: 'AEAT', kind: 'html' as const, url: 'https://www.agenciatributaria.es/irpf', topics: [], refreshDays: 7 };
const config = (): AdvisorSourcesConfig => ({ allowedHosts: ['www.boe.es', 'www.agenciatributaria.es'], sources: [boe, page] });

describe('hosts and topics', () => {
  it('reads hosts one per line or with commas, reducing addresses to their host', () => {
    expect(parseHosts('WWW.BOE.es\nhttps://www.seg-social.es/pagina, www.boe.es')).toEqual(['www.boe.es', 'www.seg-social.es']);
    expect(parseHosts('  \n ')).toEqual([]);
  });
  it('reads topics separated by commas', () => {
    expect(parseTopics(' irpf, , iva ,reta')).toEqual(['irpf', 'iva', 'reta']);
  });
});

describe('checkSources', () => {
  it('accepts a good list', () => {
    expect(checkSources(config())).toBeNull();
  });
  it('refuses an address outside the allowed hosts, or not https', () => {
    expect(checkSources({ ...config(), sources: [{ ...page, url: 'https://evil.example.com/x' }] })).toMatch(/no está entre los sitios permitidos/);
    expect(checkSources({ ...config(), sources: [{ ...page, url: 'http://www.agenciatributaria.es/x' }] })).toMatch(/https/);
    expect(checkSources({ ...config(), sources: [{ ...page, url: 'no es una dirección' }] })).toMatch(/https/);
    expect(checkSources({ ...config(), sources: [{ ...page, url: 'https://user:pw@www.agenciatributaria.es/x' }] })).toMatch(/https/);
  });
  it('checks ids, repeated ids, names and days', () => {
    expect(checkSources({ ...config(), sources: [{ ...page, id: '../x' }] })).toMatch(/identificador/);
    expect(checkSources({ ...config(), sources: [page, page] })).toMatch(/repetido/);
    expect(checkSources({ ...config(), sources: [{ ...page, name: ' ' }] })).toMatch(/nombre/);
    expect(checkSources({ ...config(), sources: [{ ...page, refreshDays: 0 }] })).toMatch(/entre 1 y 365/);
    expect(checkSources({ ...config(), sources: [] })).toMatch(/al menos una fuente/);
    expect(checkSources({ ...config(), allowedHosts: [] })).toMatch(/al menos un sitio/);
    expect(checkSources({ ...config(), allowedHosts: ['https://x'] })).toMatch(/no es un nombre/);
  });
  it('needs a BOE id and www.boe.es for a law of the BOE', () => {
    expect(checkSources({ ...config(), sources: [{ ...boe, boeId: 'x' }] })).toMatch(/BOE/);
    expect(checkSources({ allowedHosts: ['www.agenciatributaria.es'], sources: [boe] })).toMatch(/www\.boe\.es/);
  });
  it('a new blank source is not valid until it is filled in', () => {
    expect(checkSources({ ...config(), sources: [blankSource()] })).not.toBeNull();
  });
});

describe('cleanConfig', () => {
  it('trims and keeps only the address field of each kind', () => {
    const cleaned = cleanConfig({ allowedHosts: ['WWW.BOE.ES'], sources: [{ ...boe, name: ' Ley ', url: 'https://x' }, { ...page, boeId: 'BOE-A-1-1' }] });
    expect(cleaned.allowedHosts).toEqual(['www.boe.es']);
    expect(cleaned.sources[0]).toEqual({ ...boe, name: 'Ley' });
    expect(cleaned.sources[1]).toEqual(page);
  });
  it('knows when nothing changed', () => {
    expect(sameConfig(config(), { ...config(), sources: [{ ...boe, name: ' Ley del IVA ' }, page] })).toBe(true);
    expect(sameConfig(config(), { ...config(), sources: [boe] })).toBe(false);
  });
});

describe('describeRun', () => {
  const run = (status: IngestionRun['status'], results: IngestionRun['results']): IngestionRun => ({ id: 1, startedAt: '2026-10-28T10:00:00Z', status, results });
  it('says what is happening and what came out', () => {
    expect(describeRun(run('RUNNING', []))).toMatch(/Leyendo/);
    expect(
      describeRun(
        run('SUCCEEDED', [
          { sourceId: 'a', outcome: 'ADDED', chunks: 1200 },
          { sourceId: 'b', outcome: 'UNCHANGED', chunks: 0 },
          { sourceId: 'c', outcome: 'FAILED', chunks: 0, error: 'boom' },
        ]),
      ),
    ).toBe('1 añadidas, 1 sin cambios, 1 con error · 1.200 fragmentos indexados');
  });
});
