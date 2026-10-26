import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errorText, Notice, Origin, Page, Panel, useAction } from '../components/ui';
import { StatusSwitch } from '../components/StatusSwitch';
import { fetchTwoStep, setTwoStep } from '../lib/api';
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
        <StatusSwitch
          label={parameter.title}
          on={open}
          onText="Abierto"
          offText="Cerrado"
          onGlyph="unlock"
          offGlyph="lock"
          disabled={action.busy}
          onToggle={toggle}
        />
      }
    >
      <Origin parameter={parameter} />
      <div className="mt-2">
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

/**
 * The second factor of every sign-in. Off, the password is enough for everybody: for when the e-mail with the code does not
 * arrive (or lands in the spam folder) and people cannot get in. It is switched on again here, and it is in the history.
 */
function TwoStepCard() {
  const { data: on, error } = useQuery({ queryKey: ['two-step'], queryFn: fetchTwoStep });
  const client = useQueryClient();
  const action = useAction();
  const title = 'Verificación en dos pasos';

  const toggle = () => {
    if (on === undefined) return;
    if (
      on &&
      !window.confirm(
        'Con la verificación desactivada, bastará la contraseña para entrar a la aplicación, a este back office y a Grafana, en todas las cuentas. ¿Desactivarla hasta que la vuelvas a activar?',
      )
    )
      return;
    void action.run(async () => {
      await setTwoStep(!on);
      await Promise.all([client.invalidateQueries({ queryKey: ['two-step'] }), client.invalidateQueries({ queryKey: ['audit'] })]);
    }, on ? 'Desactivada: ya basta la contraseña. Actívala cuando el correo funcione.' : 'Activada de nuevo.');
  };

  return (
    <Panel
      title={title}
      subtitle="Al entrar desde un dispositivo que no es de confianza se pide un código (por correo, app o llave). Si el correo no llega o cae en spam, desactívala aquí para que se pueda entrar solo con la contraseña, y vuelve a activarla en cuanto se arregle. Si tampoco puedes entrar a este back office: keycloak-setup.sh mfa-off en el servidor."
      actions={
        <StatusSwitch
          label={title}
          on={on}
          onText="Activada"
          offText="Desactivada"
          onGlyph="shield-check"
          offGlyph="shield-off"
          disabled={action.busy}
          onToggle={toggle}
        />
      }
    >
      {error && <Notice message={{ kind: 'error', text: errorText(error) }} />}
      {on === false && (
        <p className="text-sm font-medium text-red-700">Ahora mismo cualquiera con la contraseña de una cuenta puede entrar sin código.</p>
      )}
      <div className="mt-2">
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

export function FlagsPage() {
  const { data, error, isPending } = useParameters();
  return (
    <Page title="Funciones" intro="Interruptores para cerrar una función de la aplicación sin desplegar nada: por ejemplo, el alta de cuentas durante una incidencia, o la lectura de tickets si el servidor va justo de CPU. Aquí también se desactiva la verificación en dos pasos si el correo con el código no llega.">
      {isPending && <p className="text-sm text-slate-500">Cargando…</p>}
      {error && <Notice message={{ kind: 'error', text: errorText(error) }} />}
      <TwoStepCard />
      {parametersOf(data, 'flags').map((p) => (
        <FlagCard key={p.key} parameter={p} />
      ))}
    </Page>
  );
}
