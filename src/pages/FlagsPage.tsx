import { Notice, Origin, Page, Panel, useAction } from '../components/ui';
import { parametersOf, useParameters, useParameterWrites } from '../lib/queries';
import type { Parameter } from '../lib/types';

function FlagCard({ parameter }: { parameter: Parameter }) {
  const open = parameter.value === true;
  const { save } = useParameterWrites();
  const action = useAction();

  const toggle = () => {
    if (open && !window.confirm(`¿Cerrar «${parameter.title}»? Las personas dejarán de poder usarlo hasta que lo vuelvas a abrir.`)) return;
    void action.run(() => save(parameter.scope, parameter.key, !open), open ? 'Cerrado. Se aplica en unos segundos.' : 'Abierto de nuevo.');
  };

  return (
    <Panel
      title={parameter.title}
      subtitle={parameter.description}
      actions={
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label={parameter.title}
          disabled={action.busy}
          onClick={toggle}
          className={`flex w-28 items-center justify-between gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${open ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700'}`}
        >
          <span>{open ? 'Abierto' : 'Cerrado'}</span>
          <span aria-hidden="true" className={`size-3 rounded-full ${open ? 'bg-green-400' : 'bg-red-400'}`} />
        </button>
      }
    >
      <Origin parameter={parameter} />
      <div className="mt-2">
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

export function FlagsPage() {
  const { data, error, isPending } = useParameters();
  return (
    <Page title="Funciones" intro="Interruptores para cerrar una función de la aplicación sin desplegar nada: por ejemplo, el alta de cuentas durante una incidencia, o la lectura de tickets si el servidor va justo de CPU.">
      {isPending && <p className="text-sm text-slate-500">Cargando…</p>}
      {error && <Notice message={{ kind: 'error', text: 'No se pudieron cargar las funciones.' }} />}
      {parametersOf(data, 'flags').map((p) => (
        <FlagCard key={p.key} parameter={p} />
      ))}
    </Page>
  );
}
