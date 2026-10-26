import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, errorText, inputClass, Notice, Page, Panel, useAction } from '../components/ui';
import { deleteBrackets, fetchBracketYears, fetchBrackets, saveBrackets } from '../lib/api';
import { addBracket, checkBrackets, copyTable, relink } from '../lib/brackets';
import type { BracketRow } from '../lib/types';

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });

/** Parses what was typed (comma or point as decimal separator); NaN when empty. */
const parse = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));

function Editor({ year, initial, isNew, onDone }: { year: number; initial: BracketRow[]; isNew: boolean; onDone: (deleted?: boolean) => void }) {
  const [rows, setRows] = useState<BracketRow[]>(initial);
  // What is typed, by row and column, so "7" on the way to "7,5" is not rewritten under the cursor
  const [typed, setTyped] = useState<Record<string, string>>({});
  const client = useQueryClient();
  const action = useAction();

  const problem = checkBrackets(rows);
  const changed = isNew || JSON.stringify(rows) !== JSON.stringify(initial);
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['bracket-years'] }), client.invalidateQueries({ queryKey: ['brackets'] }), client.invalidateQueries({ queryKey: ['audit'] })]);

  const shown = (i: number, field: keyof BracketRow) => typed[`${i}.${field}`] ?? String(rows[i]![field] ?? '');
  const edit = (i: number, field: 'yieldTo' | 'minimumBase' | 'maximumBase' | 'monthlyQuota', text: string) => {
    setTyped({ ...typed, [`${i}.${field}`]: text });
    setRows(relink(rows.map((r, at) => (at === i ? { ...r, [field]: parse(text) } : r))));
  };
  const structure = (next: BracketRow[]) => {
    setTyped({});
    setRows(next);
  };

  return (
    <Panel
      title={`Tabla de ${year}`}
      subtitle="Cada tramo empieza donde acaba el anterior; el último queda abierto. Comprueba las cifras con la orden oficial del año antes de guardar."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="eyebrow text-left">
              <th className="px-2 py-2 font-medium">Tramo</th>
              <th className="px-2 py-2 font-medium">Rendimiento neto mensual desde</th>
              <th className="px-2 py-2 font-medium">hasta</th>
              <th className="px-2 py-2 font-medium">Base mínima</th>
              <th className="px-2 py-2 font-medium">Base máxima</th>
              <th className="px-2 py-2 font-medium">Cuota mensual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const last = i === rows.length - 1;
              return (
                <tr key={i}>
                  <td className="px-2 py-1.5 font-medium">{r.number}</td>
                  <td className="px-2 py-1.5 tabular-nums">{Number.isFinite(r.yieldFrom) ? euro.format(r.yieldFrom) : '—'}</td>
                  <td className="px-2 py-1.5">
                    {last ? (
                      <span className="text-slate-500">sin límite</span>
                    ) : (
                      <input aria-label={`Tramo ${r.number}: hasta`} inputMode="decimal" className={`${inputClass} px-2 py-1.5`} value={shown(i, 'yieldTo')} onChange={(e) => edit(i, 'yieldTo', e.target.value)} />
                    )}
                  </td>
                  {(['minimumBase', 'maximumBase', 'monthlyQuota'] as const).map((field) => (
                    <td key={field} className="px-2 py-1.5">
                      <input
                        aria-label={`Tramo ${r.number}: ${field === 'minimumBase' ? 'base mínima' : field === 'maximumBase' ? 'base máxima' : 'cuota mensual'}`}
                        inputMode="decimal"
                        className={`${inputClass} px-2 py-1.5`}
                        value={shown(i, field)}
                        onChange={(e) => edit(i, field, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {problem && <p role="alert" className="mt-2 text-sm text-red-700">{problem}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => structure(addBracket(rows))}>
          Añadir un tramo
        </Button>
        <Button variant="secondary" disabled={rows.length < 2} onClick={() => structure(relink(rows.slice(0, -1)))}>
          Quitar el último
        </Button>
        <Button
          disabled={!changed || problem !== null || action.busy}
          onClick={() =>
            void action.run(async () => {
              await saveBrackets(year, rows);
              await refresh();
              onDone();
            }, `Tabla de ${year} guardada.`)
          }
        >
          Guardar
        </Button>
        {!isNew && (
          <Button
            variant="danger"
            disabled={action.busy}
            onClick={() => {
              if (!window.confirm(`¿Borrar la tabla de ${year}? Las estimaciones de ese año dejarán de funcionar hasta que cargues otra.`)) return;
              void action.run(async () => {
                await deleteBrackets(year);
                await refresh();
                onDone(true);
              }, `Tabla de ${year} borrada.`);
            }}
          >
            Borrar la tabla
          </Button>
        )}
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

export function SocialSecurityPage() {
  const years = useQuery({ queryKey: ['bracket-years'], queryFn: fetchBracketYears });
  const [year, setYear] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ year: number; rows: BracketRow[] } | null>(null);
  const [newYear, setNewYear] = useState(String(new Date().getFullYear() + 1));

  const selected = draft ? draft.year : (year ?? years.data?.[0]?.year ?? null);
  const table = useQuery({ queryKey: ['brackets', selected], queryFn: () => fetchBrackets(selected!), enabled: selected !== null && !draft });
  const exists = (y: number) => years.data?.some((item) => item.year === y) ?? false;
  const newYearNumber = Number(newYear);
  const canStart = Number.isInteger(newYearNumber) && newYearNumber >= 2000 && newYearNumber <= 2100 && !exists(newYearNumber);

  const startFrom = async () => {
    const base = selected !== null && !draft ? (table.data ?? (await fetchBrackets(selected))) : [];
    setDraft({ year: newYearNumber, rows: copyTable(base).map((r) => ({ ...r })) });
  };

  return (
    <Page title="Seguridad Social" intro="La tabla de tramos de cotización de autónomos (RETA). La Seguridad Social publica una nueva cada año: crea la del año siguiente a partir de la actual y ajusta las cifras.">
      <Panel title="Tablas cargadas">
        {years.isPending && <p className="text-sm text-slate-500">Cargando…</p>}
        {years.error && <Notice message={{ kind: 'error', text: errorText(years.error) }} />}
        <div className="flex flex-wrap items-end gap-2">
          {years.data?.map((item) => (
            <button
              key={item.year}
              type="button"
              aria-pressed={!draft && selected === item.year}
              onClick={() => {
                setDraft(null);
                setYear(item.year);
              }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${!draft && selected === item.year ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700'}`}
            >
              {item.year} <span className="font-normal text-slate-500">({item.count} tramos)</span>
            </button>
          ))}
          <div className="ml-auto flex items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Nueva tabla del año</span>
              <input aria-label="Año de la nueva tabla" type="number" className={`${inputClass} w-28`} value={newYear} onChange={(e) => setNewYear(e.target.value)} />
            </label>
            <Button variant="secondary" disabled={!canStart} onClick={() => void startFrom()}>
              {selected !== null && !draft ? `Crearla copiando ${selected}` : 'Crearla'}
            </Button>
          </div>
        </div>
      </Panel>

      {draft && <Editor key={`new-${draft.year}`} year={draft.year} initial={draft.rows} isNew onDone={() => { setYear(draft.year); setDraft(null); }} />}
      {!draft && selected !== null && table.data && (
        <Editor key={`${selected}-${JSON.stringify(table.data)}`} year={selected} initial={table.data} isNew={false} onDone={(deleted) => { if (deleted) setYear(null); }} />
      )}
      {!draft && selected !== null && table.isPending && <p className="text-sm text-slate-500">Cargando la tabla…</p>}
      {!draft && selected === null && years.data?.length === 0 && <p className="text-sm text-slate-500">No hay ninguna tabla cargada. Crea la del año en curso con el botón de arriba.</p>}
    </Page>
  );
}
