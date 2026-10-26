import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSessionUser } from '../auth/AuthGate';
import { setUpSecondFactor, signOut } from '../auth/oidc';
import { Button, errorText, Field, inputClass, Notice, Page, Panel, useAction } from '../components/ui';
import {
  changePassword,
  closeSession,
  endAllSessions,
  exportAccountData,
  fetchAccount,
  fetchMunicipalities,
  fetchProvinces,
  fetchSecurity,
  fetchSessions,
  forgetTrustedDevices,
  setMfaMethod,
  updateAccount,
} from '../lib/api';
import { describeSession, exportFileName, lastUseText, methodStates, methodSummary, orderSessions, passwordProblem, trustedDevicesText } from '../lib/security';
import type { Account, AccountUpdate, MfaMethod } from '../lib/types';

const toForm = (a: Account): AccountUpdate => ({
  firstName: a.firstName,
  lastName: a.lastName,
  address: a.address,
  postalCode: a.postalCode,
  provinceCode: a.provinceCode ?? '',
  locality: a.locality,
  phone: a.phone,
});

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <dt className="text-slate-600">{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

function ProfileCard({ account }: { account: Account }) {
  const client = useQueryClient();
  const [form, setForm] = useState<AccountUpdate>(toForm(account));
  const action = useAction();
  const provinces = useQuery({ queryKey: ['provinces'], queryFn: fetchProvinces, staleTime: Infinity });
  const localities = useQuery({
    queryKey: ['municipalities', form.provinceCode],
    queryFn: () => fetchMunicipalities(form.provinceCode),
    enabled: form.provinceCode !== '',
    staleTime: Infinity,
  });
  const set = <K extends keyof AccountUpdate>(field: K, value: AccountUpdate[K]) => setForm((current) => ({ ...current, [field]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(account));

  const text = (field: 'firstName' | 'lastName' | 'address' | 'phone', label: string, autoComplete: string) => (
    <Field label={label} htmlFor={`a-${field}`}>
      <input id={`a-${field}`} autoComplete={autoComplete} className={inputClass} value={form[field]} onChange={(e) => set(field, e.target.value)} />
    </Field>
  );

  // The first two digits of a postal code are the province
  const changePostalCode = (value: string) => {
    const prefix = value.trim().slice(0, 2);
    if (/^[0-9]{5}$/.test(value.trim()) && prefix !== form.provinceCode && provinces.data?.some((p) => p.code === prefix)) {
      setForm({ ...form, postalCode: value, provinceCode: prefix, locality: '' });
    } else {
      set('postalCode', value);
    }
  };

  const save = () =>
    action.run(async () => {
      const saved = await updateAccount(form);
      client.setQueryData(['account'], saved);
      setForm(toForm(saved));
    }, 'Datos guardados.');

  return (
    <Panel title="Datos personales" subtitle="El correo y el DNI/NIE no se pueden cambiar aquí: identifican tu cuenta.">
      <dl className="mb-3 divide-y divide-slate-100">
        <ReadOnlyRow label="Correo electrónico" value={account.email} />
        <ReadOnlyRow label="DNI / NIE" value={account.dni} />
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        {text('firstName', 'Nombre', 'given-name')}
        {text('lastName', 'Apellidos', 'family-name')}
        {text('address', 'Domicilio (calle, número y piso)', 'street-address')}
        <Field label="Código postal" htmlFor="a-postalCode">
          <input id="a-postalCode" inputMode="numeric" maxLength={5} autoComplete="postal-code" className={inputClass} value={form.postalCode} onChange={(e) => changePostalCode(e.target.value)} />
        </Field>
        <Field label="Provincia" htmlFor="a-province">
          <select id="a-province" className={inputClass} value={form.provinceCode} onChange={(e) => setForm({ ...form, provinceCode: e.target.value, locality: '' })}>
            <option value="">Elige una provincia</option>
            {provinces.data?.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Localidad" htmlFor="a-locality">
          <select id="a-locality" className={inputClass} value={form.locality} disabled={form.provinceCode === ''} onChange={(e) => set('locality', e.target.value)}>
            <option value="">Elige una localidad</option>
            {form.locality && !localities.data?.includes(form.locality) && <option value={form.locality}>{form.locality}</option>}
            {localities.data?.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {text('phone', 'Teléfono', 'tel')}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={action.busy || !dirty} onClick={() => void save()}>
          {action.busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeated, setRepeated] = useState('');
  const action = useAction();
  const problem = passwordProblem(current, next, repeated);

  return (
    <Panel title="Cambiar contraseña" subtitle="Se olvidan los dispositivos de confianza: en cada uno se pedirá el código de nuevo.">
      <div className="max-w-sm space-y-3">
        <Field label="Contraseña actual" htmlFor="pw-current">
          <input id="pw-current" type="password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Nueva contraseña (mínimo 8 caracteres)" htmlFor="pw-new">
          <input id="pw-new" type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Repite la nueva contraseña" htmlFor="pw-repeat">
          <input id="pw-repeat" type="password" autoComplete="new-password" className={inputClass} value={repeated} onChange={(e) => setRepeated(e.target.value)} />
        </Field>
        {next && problem && <p className="text-xs text-slate-500">{problem}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={action.busy || problem !== null}
            onClick={() =>
              void action.run(async () => {
                await changePassword(current, next);
                setCurrent('');
                setNext('');
                setRepeated('');
              }, 'Contraseña cambiada.')
            }
          >
            {action.busy ? 'Cambiando…' : 'Cambiar contraseña'}
          </Button>
          <Notice message={action.message} />
        </div>
      </div>
    </Panel>
  );
}

/** One word of state on a method: the default, set up, not set up. */
function StatusBadge({ tone, children }: { tone: 'brand' | 'green' | 'slate'; children: string }) {
  const classes = { brand: 'bg-brand-50 text-brand-700', green: 'bg-green-50 text-green-700', slate: 'bg-slate-100 text-slate-600' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[tone]}`}>{children}</span>;
}

/**
 * The second factor asked at a sign-in on a device that is not trusted. Each of the three methods says whether it is set up, whether it
 * is the default (the one in use) and, if it can be used, that it can be chosen instead on the verification page when the default
 * cannot be used. The default is chosen here, with the password asked again.
 */
function SecondFactorCard() {
  const client = useQueryClient();
  const security = useQuery({ queryKey: ['security'], queryFn: fetchSecurity });
  const [chosen, setChosen] = useState<MfaMethod | null>(null);
  const [password, setPassword] = useState('');
  const action = useAction();

  const data = security.data;
  const chosenState = data && chosen ? methodStates(data).find((s) => s.id === chosen) : undefined;

  const save = (method: MfaMethod) =>
    action.run(async () => {
      client.setQueryData(['security'], await setMfaMethod(method, password));
      setChosen(null);
      setPassword('');
    }, 'Método por defecto cambiado.');
  const forget = () =>
    action.run(async () => {
      await forgetTrustedDevices();
      await client.invalidateQueries({ queryKey: ['security'] });
    }, 'Todos los dispositivos volverán a pedir el código.');

  return (
    <Panel
      title="Verificación en dos pasos"
      subtitle="Al iniciar sesión en un dispositivo nuevo o que no es de confianza se pide, además de la contraseña, un código con el método por defecto. En la administración siempre está activa."
    >
      {security.isPending && <p className="text-sm text-slate-500">Cargando…</p>}
      {security.isError && <Notice message={{ kind: 'error', text: errorText(security.error) }} />}
      {data && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">{methodSummary(data)}</p>
          <ul className="space-y-2">
            {methodStates(data).map((m) => (
              <li key={m.id} className={`rounded-lg border p-3 ${m.isDefault ? 'border-brand-600' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{m.label}</span>
                  {m.isDefault && <StatusBadge tone="brand">Por defecto</StatusBadge>}
                  <StatusBadge tone={m.configured ? 'green' : 'slate'}>{m.configured ? 'Configurado' : 'No configurado'}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{m.hint}</p>
                <p className={`mt-1 text-xs ${m.isDefault ? 'font-medium text-brand-700' : 'text-slate-600'}`}>{m.usage}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {m.configured && !m.isDefault && (
                    <button type="button" onClick={() => { setChosen(m.id); setPassword(''); action.clear(); }} className="text-sm font-medium text-brand-700 underline">
                      Usar por defecto
                    </button>
                  )}
                  {m.id !== 'email' && (
                    <button
                      type="button"
                      onClick={() => void setUpSecondFactor(m.id === 'totp' ? 'CONFIGURE_TOTP' : 'webauthn-register', '/account')}
                      className="text-sm font-medium text-brand-700 underline"
                    >
                      {m.configured ? 'Añadir otra' : m.id === 'totp' ? 'Configurar la app' : 'Registrar una llave o biometría'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {chosenState && (
            <div className="max-w-sm space-y-2 rounded-lg bg-slate-50 p-3">
              <p className="text-sm">Vas a usar <strong>{chosenState.label}</strong> como método por defecto.</p>
              <Field label="Tu contraseña, para confirmar el cambio" htmlFor="mfa-password">
                <input id="mfa-password" type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button disabled={action.busy || !password} onClick={() => void save(chosenState.id)}>
                  {action.busy ? 'Guardando…' : 'Confirmar'}
                </Button>
                <Button variant="secondary" onClick={() => setChosen(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-600">
              {trustedDevicesText(data.trustedDevices)} Se marcan con «Confío en este dispositivo» al iniciar sesión y no piden el código.
            </p>
            {data.trustedDevices > 0 && (
              <Button variant="secondary" disabled={action.busy} onClick={() => void forget()}>
                Olvidar dispositivos de confianza
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="mt-2">
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

/** The sign-ins that are open, each with its own button to close it, and the one that closes them all. */
function SessionsCard() {
  const client = useQueryClient();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions });
  const action = useAction();
  const close = useMutation({
    mutationFn: closeSession,
    onSuccess: () => client.invalidateQueries({ queryKey: ['sessions'] }),
  });

  return (
    <Panel title="Sesiones abiertas" subtitle="Los dispositivos donde has iniciado sesión. Cierra los que no reconozcas o ya no uses.">
      {sessions.isPending && <p className="text-sm text-slate-500">Cargando…</p>}
      {sessions.isError && <Notice message={{ kind: 'error', text: errorText(sessions.error) }} />}
      {sessions.data && (
        <ul className="mb-3 divide-y divide-slate-100">
          {orderSessions(sessions.data).map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {describeSession(session)}
                  {session.current && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-normal text-brand-700">Este dispositivo</span>}
                </p>
                <p className="text-xs text-slate-500">{lastUseText(session)}</p>
              </div>
              {!session.current && (
                <Button variant="secondary" disabled={close.isPending} onClick={() => close.mutate(session.id)}>
                  Cerrar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {close.isError && <Notice message={{ kind: 'error', text: errorText(close.error) }} />}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await endAllSessions();
              await signOut();
            }, 'Sesiones cerradas.')
          }
        >
          Cerrar sesión en todos los dispositivos
        </Button>
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

function DataCard() {
  const action = useAction();
  const download = async () => {
    const blob = await exportAccountData();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName(new Date());
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Panel title="Mis datos" subtitle="Descarga una copia en JSON de lo que se guarda de tu cuenta.">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={action.busy} onClick={() => void action.run(download, 'Copia descargada.')}>
          {action.busy ? 'Preparando…' : 'Descargar mis datos'}
        </Button>
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

/** The account of the administrator who is signed in: the same sections as the customers' app has (except deleting the account). */
export function AccountPage() {
  const me = useSessionUser();
  const account = useQuery({ queryKey: ['account'], queryFn: fetchAccount });
  return (
    <Page title="Cuenta" intro={`Tu cuenta de administración${me?.profile.email ? ` (${me.profile.email})` : ''}: tus datos, la contraseña, la verificación en dos pasos y las sesiones abiertas.`}>
      {account.isPending && <p className="text-sm text-slate-500">Cargando…</p>}
      {account.isError && <Notice message={{ kind: 'error', text: errorText(account.error) }} />}
      {account.data && <ProfileCard account={account.data} />}
      <PasswordCard />
      <SecondFactorCard />
      <SessionsCard />
      <DataCard />
    </Page>
  );
}
