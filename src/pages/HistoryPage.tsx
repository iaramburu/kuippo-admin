import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, formatDateTime, inputClass, Notice, Page, Panel, useAction } from '../components/ui';
import { fetchAudit, revertChange } from '../lib/api';
import { describeEntry, SCOPES, summarize } from '../lib/audit';
import { useParameters } from '../lib/queries';
import type { AuditEntry } from '../lib/types';

const PAGE = 30;

function Entry({ entry, title }: { entry: AuditEntry; title: string }) {
  const client = useQueryClient();
  const action = useAction();
  const undo = () => {
    if (!window.confirm('¿Deshacer este cambio? Se devuelve el valor que había antes, y queda anotado en el historial.')) return;
    void action.run(async () => {
      await revertChange(entry.id);
      await Promise.all([client.invalidateQueries({ queryKey: ['audit'] }), client.invalidateQueries({ queryKey: ['parameters'] }), client.invalidateQueries({ queryKey: ['bracket-years'] }), client.invalidateQueries({ queryKey: ['brackets'] })]);
    }, 'Cambio deshecho.');
  };
  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{title}</p>
        <time dateTime={entry.at} className="text-xs text-slate-500">
          {formatDateTime(entry.at)}
        </time>
      </div>
      {entry.scope !== 'users' && (
        <p className="break-words text-xs text-slate-600">
          Antes: {summarize(entry.before)}
          <br />
          Después: {summarize(entry.after)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {entry.revertible && (
          <Button variant="secondary" disabled={action.busy} onClick={undo} aria-label={`Deshacer: ${title}`}>
            Deshacer
          </Button>
        )}
        <Notice message={action.message} />
      </div>
    </li>
  );
}

export function HistoryPage() {
  const [scope, setScope] = useState('');
  const parameters = useParameters();
  const log = useInfiniteQuery({
    queryKey: ['audit', scope],
    queryFn: ({ pageParam }) => fetchAudit(scope, pageParam, PAGE),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]!.id : undefined),
  });
  const entries = log.data?.pages.flat() ?? [];

  return (
    <Page title="Historial" intro="Todo lo que han cambiado los administradores: quién, cuándo y qué valor había antes y después. Los cambios de ajustes y de tablas se pueden deshacer; los de cuentas, no.">
      <Panel
        title="Cambios"
        actions={
          <label className="flex items-center gap-2 text-sm">
            Mostrar
            <select aria-label="Filtrar por ámbito" className={`${inputClass} w-auto`} value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">Todo</option>
              {Object.entries(SCOPES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {log.isPending && <p className="text-sm text-slate-500">Cargando…</p>}
        {log.error && <Notice message={{ kind: 'error', text: 'No se pudo cargar el historial.' }} />}
        {!log.isPending && entries.length === 0 && <p className="text-sm text-slate-500">Todavía no hay cambios.</p>}
        <ul className="divide-y divide-slate-200 text-sm">
          {entries.map((entry) => (
            <Entry key={entry.id} entry={entry} title={describeEntry(entry, parameters.data ?? [])} />
          ))}
        </ul>
        {log.hasNextPage && (
          <div className="mt-3">
            <Button variant="secondary" disabled={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
              Ver más antiguos
            </Button>
          </div>
        )}
      </Panel>
    </Page>
  );
}
