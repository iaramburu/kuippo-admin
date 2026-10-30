import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, errorText, Field, formatDateTime, inputClass, Notice, Page, Panel, useAction } from '../components/ui';
import { fetchAdvisorTools, fetchIngestionRuns, fetchSourceStatus, resetAdvisorSources, saveAdvisorSources, startIngestion, ApiError } from '../lib/api';
import {
  KINDS,
  blankSource,
  checkSources,
  cleanConfig,
  describeRun,
  formatCount,
  parseHosts,
  parseTopics,
  sameConfig,
  topicsText,
} from '../lib/advisor';
import type { AdvisorSource, AdvisorSourcesConfig, IngestionRun } from '../lib/types';

function SourceEditor({ source, onChange, onRemove }: { source: AdvisorSource; onChange: (next: AdvisorSource) => void; onRemove: () => void }) {
  const set = <K extends keyof AdvisorSource>(key: K, value: AdvisorSource[K]) => onChange({ ...source, [key]: value });
  const name = source.id || 'nueva fuente';
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Identificador" hint="Minúsculas, números y guiones. Lo usan las Skills.">
          <input aria-label={`${name}: identificador`} className={inputClass} value={source.id} onChange={(e) => set('id', e.target.value)} />
        </Field>
        <Field label="Nombre">
          <input aria-label={`${name}: nombre`} className={inputClass} value={source.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Organismo">
          <input aria-label={`${name}: organismo`} className={inputClass} value={source.authority} onChange={(e) => set('authority', e.target.value)} />
        </Field>
        <Field label="Tipo">
          <select aria-label={`${name}: tipo`} className={inputClass} value={source.kind} onChange={(e) => set('kind', e.target.value as AdvisorSource['kind'])}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        {source.kind === 'boe-xml' ? (
          <Field label="Identificador del BOE" hint="Por ejemplo BOE-A-1992-28740 (está en la dirección de la ley).">
            <input aria-label={`${name}: identificador del BOE`} className={inputClass} value={source.boeId ?? ''} onChange={(e) => set('boeId', e.target.value)} />
          </Field>
        ) : (
          <Field label="Dirección" hint="https y de un sitio permitido.">
            <input aria-label={`${name}: dirección`} className={inputClass} value={source.url ?? ''} onChange={(e) => set('url', e.target.value)} />
          </Field>
        )}
        <Field label="Temas" hint="Separados por comas (irpf, iva, reta…).">
          <input aria-label={`${name}: temas`} className={inputClass} defaultValue={topicsText(source.topics)} onBlur={(e) => set('topics', parseTopics(e.target.value))} />
        </Field>
        <Field label="Releer cada (días)">
          <input aria-label={`${name}: días`} type="number" min="1" max="365" className={inputClass} value={source.refreshDays} onChange={(e) => set('refreshDays', Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-2 text-right">
        <Button variant="danger" onClick={onRemove}>
          Quitar
        </Button>
      </div>
    </div>
  );
}

function SourcesPanel({ saved, customized, onDirty }: { saved: AdvisorSourcesConfig; customized: boolean; onDirty: (dirty: boolean) => void }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<AdvisorSourcesConfig>(saved);
  const [hostsText, setHostsText] = useState(saved.allowedHosts.join('\n'));
  const action = useAction();
  // The list saved elsewhere (another tab, a reset) replaces what is shown
  useEffect(() => {
    setDraft(saved);
    setHostsText(saved.allowedHosts.join('\n'));
  }, [saved]);

  const current: AdvisorSourcesConfig = { ...draft, allowedHosts: parseHosts(hostsText) };
  const problem = checkSources(current);
  const changed = !sameConfig(current, saved);
  useEffect(() => onDirty(changed), [changed, onDirty]);
  const refresh = () => client.invalidateQueries({ queryKey: ['advisor'] });

  const save = () =>
    action.run(async () => {
      await saveAdvisorSources(cleanConfig(current));
      await refresh();
    }, 'Guardado. Las fuentes nuevas aún no tienen vectores: lanza la ingesta.');
  const reset = () => {
    if (!window.confirm('¿Volver a la lista de fuentes que viene con el código? Se pierde tu lista y se olvida lo ingerido de las fuentes que no estén en ella.')) return;
    void action.run(async () => {
      await resetAdvisorSources();
      await refresh();
    }, 'Restaurada la lista original.');
  };

  return (
    <Panel
      title="De dónde lee el asesor"
      subtitle={customized ? 'Estás usando tu propia lista (no la que viene con el código).' : 'Es la lista que viene con el código; al guardar cambios pasa a ser tu propia lista.'}
    >
      <Field label="Sitios web permitidos" hint="El asesor solo descarga de estos sitios, siempre por https. Uno por línea.">
        <textarea aria-label="Sitios web permitidos" rows={4} className={inputClass} value={hostsText} onChange={(e) => setHostsText(e.target.value)} />
      </Field>
      <div className="mt-4 space-y-3">
        {draft.sources.map((source, i) => (
          <SourceEditor
            key={i}
            source={source}
            onChange={(next) => setDraft({ ...draft, sources: draft.sources.map((s, j) => (j === i ? next : s)) })}
            onRemove={() => {
              if (source.id === '' || window.confirm(`¿Quitar «${source.id}»? Al guardar, el asesor olvida lo que había aprendido de ella.`)) {
                setDraft({ ...draft, sources: draft.sources.filter((_, j) => j !== i) });
              }
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setDraft({ ...draft, sources: [...draft.sources, blankSource()] })}>
          Añadir fuente
        </Button>
        <Button disabled={!changed || problem !== null || action.busy} onClick={() => void save()}>
          Guardar cambios
        </Button>
        <Button
          variant="secondary"
          disabled={!changed || action.busy}
          onClick={() => {
            setDraft(saved);
            setHostsText(saved.allowedHosts.join('\n'));
          }}
        >
          Descartar
        </Button>
        <Button variant="danger" disabled={!customized || action.busy} onClick={reset}>
          Volver a la lista original
        </Button>
      </div>
      {changed && problem && <p className="mt-2 text-sm text-amber-700">{problem}</p>}
      <div className="mt-2">
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

function RunLine({ run }: { run: IngestionRun }) {
  return (
    <li className="rounded-lg border border-slate-200 p-2 text-sm">
      <p className="font-medium">
        {formatDateTime(run.startedAt)} · {run.status === 'RUNNING' ? 'en curso' : run.status === 'SUCCEEDED' ? 'terminada' : 'fallida'}
      </p>
      <p className="text-slate-600">{describeRun(run)}</p>
      {run.results.filter((r) => r.outcome === 'FAILED').map((r) => (
        <p key={r.sourceId} className="text-red-700">
          {r.sourceId}: {r.error ?? 'error'}
        </p>
      ))}
    </li>
  );
}

function IngestionPanel({ blocked }: { blocked: boolean }) {
  const client = useQueryClient();
  const [force, setForce] = useState(false);
  const action = useAction();
  const status = useQuery({ queryKey: ['advisor', 'status'], queryFn: fetchSourceStatus });
  const runs = useQuery({
    queryKey: ['advisor', 'runs'],
    queryFn: fetchIngestionRuns,
    // while a run is going, look at it every couple of seconds
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === 'RUNNING') ? 2000 : false),
  });
  const running = runs.data?.some((r) => r.status === 'RUNNING') ?? false;
  const wasRunning = useWasRunning(running);
  useEffect(() => {
    if (wasRunning) void client.invalidateQueries({ queryKey: ['advisor', 'status'] });
  }, [wasRunning, client]);

  const start = (ids: string[]) =>
    action.run(async () => {
      await startIngestion(ids, force);
      await client.invalidateQueries({ queryKey: ['advisor', 'runs'] });
    }, 'Ingesta en marcha. Tarda unos minutos: lee las fuentes y crea los vectores con tu GPU.');

  return (
    <Panel
      title="Ingesta y vectores"
      subtitle="Lee las fuentes, las trocea y crea sus vectores con Ollama (modelo bge-m3). Una fuente que no ha cambiado no se vuelve a procesar."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Rehacer aunque no haya cambios
          </label>
          <Button disabled={running || blocked || action.busy} onClick={() => void start([])}>
            Ingerir todo y crear vectores
          </Button>
        </div>
      }
    >
      {blocked && <p className="mb-2 text-sm text-amber-700">Hay cambios sin guardar en la lista de fuentes: guárdalos o descártalos antes de ingerir.</p>}
      <Notice message={action.message} />
      {status.error && <Notice message={{ kind: 'error', text: errorText(status.error) }} />}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 pr-3">Fuente</th>
              <th className="py-1 pr-3">Fragmentos</th>
              <th className="py-1 pr-3">Última ingesta</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {(status.data ?? []).map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-1.5 pr-3">
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-slate-500">{s.id}</span>
                </td>
                <td className="py-1.5 pr-3 tabular-nums">{formatCount(s.chunks)}</td>
                <td className="py-1.5 pr-3">
                  {s.lastIngestedAt ? formatDateTime(s.lastIngestedAt) : <span className="text-amber-700">Sin ingerir</span>}
                  {s.lastIngestedAt && s.stale && <span className="block text-xs text-amber-700">Toca releerla</span>}
                </td>
                <td className="py-1.5 text-right">
                  <Button variant="secondary" disabled={running || blocked || action.busy} onClick={() => void start([s.id])}>
                    Ingerir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(runs.data ?? []).length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">Últimas ingestas</h3>
          <ul className="mt-2 space-y-2">
            {(runs.data ?? []).slice(0, 5).map((run) => (
              <RunLine key={run.id} run={run} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/** True for the render in which a run that was going has just ended. */
function useWasRunning(running: boolean): boolean {
  const [previous, setPrevious] = useState(running);
  useEffect(() => setPrevious(running), [running]);
  return previous && !running;
}

function Unavailable({ children }: { children: string }) {
  return (
    <Panel title="No disponible">
      <p className="text-sm text-slate-600">{children}</p>
    </Panel>
  );
}

/**
 * Where the advisor reads from and the button that ingests and creates the vectors. Only on a local installation: embedding
 * the sources takes a GPU the production server does not have, so there the advisor itself says it is not available.
 */
export function AdvisorPage() {
  const tools = useQuery({ queryKey: ['advisor', 'tools'], queryFn: fetchAdvisorTools, retry: false });
  const [dirty, setDirty] = useState(false);

  let body;
  if (tools.isPending) body = <p className="text-sm text-slate-500">Cargando…</p>;
  else if (tools.error) {
    const refused = tools.error instanceof ApiError;
    body = (
      <Unavailable>
        {refused
          ? `El asesor no ha aceptado la petición: ${errorText(tools.error)}`
          : 'No se puede conectar con el asesor. Arráncalo en tu equipo (puerto 8090) y recarga esta página. Esta sección solo existe en local.'}
      </Unavailable>
    );
  } else if (!tools.data.localTools || !tools.data.sources || !tools.data.allowedHosts) {
    body = <Unavailable>Esta instalación no permite editar las fuentes ni ingerirlas: es una función solo para el entorno local, donde hay GPU.</Unavailable>;
  } else {
    const saved = { allowedHosts: tools.data.allowedHosts, sources: tools.data.sources };
    body = (
      <>
        <SourcesPanel saved={saved} customized={tools.data.customized === true} onDirty={setDirty} />
        <IngestionPanel blocked={dirty} />
      </>
    );
  }

  return (
    <Page
      title="Asesor"
      intro="Las fuentes oficiales de las que lee el asesor (Seguridad Social, IRPF, IVA, autónomos) y la ingesta que crea sus vectores. Solo funciona en local."
    >
      {body}
    </Page>
  );
}
