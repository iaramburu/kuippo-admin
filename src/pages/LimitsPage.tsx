import { useState } from 'react';
import { Button, Field, inputClass, Notice, Origin, Page, Panel, useAction } from '../components/ui';
import { checkRate, describeRate, joinEvery, splitEvery, type Unit } from '../lib/rates';
import { parametersOf, useParameters, useParameterWrites } from '../lib/queries';
import type { Parameter, RateValue } from '../lib/types';

const UNITS: { id: Unit; label: string }[] = [
  { id: 'ms', label: 'milisegundos' },
  { id: 's', label: 'segundos' },
  { id: 'min', label: 'minutos' },
  { id: 'h', label: 'horas' },
];

function RateCard({ parameter }: { parameter: Parameter }) {
  const current = parameter.value as RateValue;
  const initial = splitEvery(current.everyMs);
  const [amount, setAmount] = useState(String(initial.amount));
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [burst, setBurst] = useState(String(current.burst));
  const { save, reset } = useParameterWrites();
  const action = useAction();

  const draft: RateValue = { everyMs: joinEvery(Number(amount), unit), burst: Number(burst) };
  const problem = checkRate(draft);
  const changed = draft.everyMs !== current.everyMs || draft.burst !== current.burst;
  const defaults = parameter.default as RateValue;

  return (
    <Panel title={parameter.title} subtitle={parameter.description} actions={<Origin parameter={parameter} />}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <Field label="Una petición cada">
          <input aria-label={`${parameter.title}: tiempo`} type="number" min="0" step="any" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Unidad">
          <select aria-label={`${parameter.title}: unidad`} className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ráfaga máxima" hint="Peticiones seguidas que se admiten de golpe.">
          <input aria-label={`${parameter.title}: ráfaga`} type="number" min="1" step="1" className={inputClass} value={burst} onChange={(e) => setBurst(e.target.value)} />
        </Field>
      </div>
      <p className="mt-2 text-sm text-slate-600">{problem ?? describeRate(draft)}</p>
      <p className="text-xs text-slate-500">Por defecto: {describeRate(defaults)}.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={!changed || problem !== null || action.busy} onClick={() => void action.run(() => save(parameter.scope, parameter.key, draft), 'Guardado. Se aplica en unos segundos, sin reiniciar.')}>
          Guardar
        </Button>
        <Button variant="secondary" disabled={!parameter.overridden || action.busy} onClick={() => void action.run(() => reset(parameter.scope, parameter.key), 'Restaurado el valor por defecto.')}>
          Restaurar el valor por defecto
        </Button>
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

export function LimitsPage() {
  const { data, error, isPending } = useParameters();
  return (
    <Page
      title="Límites de uso"
      intro="Cuántas peticiones admite cada parte de la API antes de decir «demasiadas peticiones». Un límite demasiado bajo molesta a las personas; uno demasiado alto deja de proteger. Los cambios se aplican en todos los servidores en unos segundos."
    >
      {isPending && <p className="text-sm text-slate-500">Cargando…</p>}
      {error && <Notice message={{ kind: 'error', text: 'No se pudieron cargar los límites.' }} />}
      {parametersOf(data, 'limits').map((p) => (
        <RateCard key={`${p.key}-${JSON.stringify(p.value)}`} parameter={p} />
      ))}
    </Page>
  );
}
