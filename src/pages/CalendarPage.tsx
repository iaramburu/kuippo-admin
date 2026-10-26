import { useMemo, useState } from 'react';
import { Button, errorText, inputClass, Notice, Origin, Page, Panel, useAction } from '../components/ui';
import { checkRules, newRule, previewDeadlines } from '../lib/calendar';
import { parametersOf, useParameters, useParameterWrites } from '../lib/queries';
import type { CalendarRule, Parameter } from '../lib/types';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dateFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

function Rules({ parameter }: { parameter: Parameter }) {
  const stored = parameter.value as CalendarRule[];
  const [rules, setRules] = useState<CalendarRule[]>(stored);
  const [year, setYear] = useState(new Date().getFullYear());
  const { save, reset } = useParameterWrites();
  const action = useAction();

  const problem = checkRules(rules);
  const changed = JSON.stringify(rules) !== JSON.stringify(stored);
  const preview = useMemo(() => (problem ? [] : previewDeadlines(rules, year)), [rules, year, problem]);
  const edit = (i: number, patch: Partial<CalendarRule>) => setRules(rules.map((r, at) => (at === i ? { ...r, ...patch } : r)));
  const small = `${inputClass} px-2 py-1.5`;

  return (
    <>
      <Panel
        title="Fechas que se repiten cada año"
        subtitle={parameter.description}
        actions={<Origin parameter={parameter} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="eyebrow text-left">
                <th className="px-2 py-2 font-medium">Identificador</th>
                <th className="px-2 py-2 font-medium">Modelos</th>
                <th className="px-2 py-2 font-medium">Descripción</th>
                <th className="px-2 py-2 font-medium">Periodo</th>
                <th className="px-2 py-2 font-medium">Año del periodo</th>
                <th className="px-2 py-2 font-medium">Vence el</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">
                    <input aria-label={`Fecha ${i + 1}: identificador`} className={small} value={r.id} onChange={(e) => edit(i, { id: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`Fecha ${i + 1}: modelos`}
                      className={small}
                      value={r.models.join(', ')}
                      onChange={(e) => edit(i, { models: e.target.value.split(',').map((m) => m.trim()).filter(Boolean) })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input aria-label={`Fecha ${i + 1}: descripción`} className={small} value={r.description} onChange={(e) => edit(i, { description: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <select aria-label={`Fecha ${i + 1}: periodo`} className={small} value={r.quarter} onChange={(e) => edit(i, { quarter: Number(e.target.value) })}>
                      <option value={0}>Resumen anual</option>
                      {[1, 2, 3, 4].map((q) => (
                        <option key={q} value={q}>
                          {q}.º trimestre
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select aria-label={`Fecha ${i + 1}: año del periodo`} className={small} value={r.periodYearOffset} onChange={(e) => edit(i, { periodYearOffset: Number(e.target.value) })}>
                      <option value={0}>El mismo año</option>
                      <option value={-1}>El año anterior</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <input aria-label={`Fecha ${i + 1}: día`} type="number" min="1" max="31" className={`${small} w-16`} value={r.day} onChange={(e) => edit(i, { day: Number(e.target.value) })} />
                      <span>de</span>
                      <select aria-label={`Fecha ${i + 1}: mes`} className={small} value={r.month} onChange={(e) => edit(i, { month: Number(e.target.value) })}>
                        {MONTHS.map((m, at) => (
                          <option key={m} value={at + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Button variant="secondary" aria-label={`Quitar la fecha ${i + 1}`} onClick={() => setRules(rules.filter((_, at) => at !== i))}>
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          En la descripción, <code>{'{quarter}'}</code> y <code>{'{year}'}</code> se sustituyen por el trimestre y el año del periodo. Si la fecha cae en fin de semana, pasa al lunes.
        </p>
        {problem && <p role="alert" className="mt-2 text-sm text-red-700">{problem}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setRules([...rules, newRule(rules.length + 1)])}>
            Añadir una fecha
          </Button>
          <Button disabled={!changed || problem !== null || action.busy} onClick={() => void action.run(() => save(parameter.scope, parameter.key, rules), 'Guardado. El calendario de la app se actualiza en unos segundos.')}>
            Guardar
          </Button>
          <Button variant="secondary" disabled={!parameter.overridden || action.busy} onClick={() => void action.run(() => reset(parameter.scope, parameter.key), 'Restaurado el calendario por defecto.')}>
            Restaurar el valor por defecto
          </Button>
          <Notice message={action.message} />
        </div>
      </Panel>

      <Panel
        title="Así lo verá la app"
        subtitle="Las fechas que salen con las reglas de arriba (aunque todavía no estén guardadas)."
        actions={
          <label className="flex items-center gap-2 text-sm">
            Año
            <input aria-label="Año de la vista previa" type="number" className={`${small} w-24`} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </label>
        }
      >
        {preview.length === 0 ? (
          <p className="text-sm text-slate-500">Corrige las fechas para ver la vista previa.</p>
        ) : (
          <ul className="divide-y divide-slate-200 text-sm">
            {preview.map((d) => (
              <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <strong>{d.description}</strong> <span className="text-slate-500">(modelos {d.models.join(', ')})</span>
                </span>
                <span className="tabular-nums">{dateFormat.format(new Date(`${d.due}T00:00:00Z`))}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export function CalendarPage() {
  const { data, error, isPending } = useParameters();
  const rules = parametersOf(data, 'calendar')[0];
  return (
    <Page title="Calendario fiscal" intro="Las fechas de presentación que la app enseña a los usuarios. Cámbialas cuando la Agencia Tributaria publique un calendario distinto.">
      {isPending && <p className="text-sm text-slate-500">Cargando…</p>}
      {error && <Notice message={{ kind: 'error', text: errorText(error) }} />}
      {rules && <Rules key={JSON.stringify(rules.value)} parameter={rules} />}
    </Page>
  );
}
