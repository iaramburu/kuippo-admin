import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Field, formatDateTime, inputClass, Notice, Page, Panel, useAction } from '../components/ui';
import { createUser, fetchMunicipalities, fetchProvinces, fetchUsers, setUserPassword, updateUser } from '../lib/api';
import type { ManagedUser, ManagedUserPayload } from '../lib/types';

const ROLES: { id: string; label: string; hint: string }[] = [
  { id: 'user', label: 'Usuario', hint: 'Usa todas las funciones de Kuippo: facturas, gastos, impuestos y contactos.' },
  { id: 'admin', label: 'Administrador', hint: 'Entra en esta administración y gestiona usuarios y ajustes, y nada más.' },
];

const blank: ManagedUserPayload = { firstName: '', lastName: '', email: '', dni: '', address: '', postalCode: '', provinceCode: '', locality: '', phone: '', roles: ['user'], enabled: true, password: '' };

const payloadOf = (u: ManagedUser): ManagedUserPayload => ({
  firstName: u.firstName, lastName: u.lastName, email: u.email, dni: u.dni, address: u.address, postalCode: u.postalCode,
  provinceCode: u.provinceCode ?? '', locality: u.locality, phone: u.phone, roles: u.roles, enabled: u.enabled,
});

const fullName = (u: ManagedUser) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

function PasswordForm({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const action = useAction();
  return (
    <Panel title={`Nueva contraseña de ${fullName(user)}`} subtitle="Se cierran todas sus sesiones abiertas. La contraseña no se guarda en ningún registro.">
      <div className="max-w-sm space-y-3">
        <Field label="Contraseña nueva (de 8 a 128 caracteres)" htmlFor="new-password">
          <input id="new-password" type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={password.length < 8 || action.busy} onClick={() => void action.run(async () => { await setUserPassword(user.id, password); setPassword(''); }, 'Contraseña cambiada y sesiones cerradas.')}>
            Cambiar la contraseña
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <Notice message={action.message} />
      </div>
    </Panel>
  );
}

function UserForm({ user, onClose }: { user: ManagedUser | null; onClose: () => void }) {
  const creating = user === null;
  const [form, setForm] = useState<ManagedUserPayload>(user ? payloadOf(user) : blank);
  const client = useQueryClient();
  const action = useAction();
  const provinces = useQuery({ queryKey: ['provinces'], queryFn: fetchProvinces, staleTime: Infinity });
  const localities = useQuery({ queryKey: ['municipalities', form.provinceCode], queryFn: () => fetchMunicipalities(form.provinceCode), enabled: form.provinceCode !== '', staleTime: Infinity });
  const set = <K extends keyof ManagedUserPayload>(field: K, value: ManagedUserPayload[K]) => setForm({ ...form, [field]: value });
  const toggleRole = (role: string) => set('roles', form.roles.includes(role) ? form.roles.filter((r) => r !== role) : [...form.roles, role]);

  const text = (field: 'firstName' | 'lastName' | 'email' | 'dni' | 'address' | 'postalCode' | 'phone', label: string) => (
    <Field label={label} htmlFor={`u-${field}`}>
      <input id={`u-${field}`} className={inputClass} value={form[field]} onChange={(e) => set(field, e.target.value)} />
    </Field>
  );

  const submit = () =>
    action.run(async () => {
      if (creating) await createUser(form);
      else await updateUser(user.id, { ...form, password: undefined });
      await client.invalidateQueries({ queryKey: ['users'] });
      await client.invalidateQueries({ queryKey: ['audit'] });
      onClose();
    }, creating ? 'Cuenta creada.' : 'Cuenta guardada.');

  return (
    <Panel title={creating ? 'Nueva cuenta' : `Cuenta de ${fullName(user)}`} subtitle={creating ? undefined : `Alta: ${formatDateTime(user.createdAt)}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {text('firstName', 'Nombre')}
        {text('lastName', 'Apellidos')}
        {text('email', 'Correo electrónico')}
        {text('dni', 'DNI o NIE')}
        {text('address', 'Dirección')}
        {text('postalCode', 'Código postal')}
        <Field label="Provincia" htmlFor="u-province">
          <select id="u-province" className={inputClass} value={form.provinceCode} onChange={(e) => setForm({ ...form, provinceCode: e.target.value, locality: '' })}>
            <option value="">Elige una provincia</option>
            {provinces.data?.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Localidad" htmlFor="u-locality">
          <select id="u-locality" className={inputClass} value={form.locality} disabled={form.provinceCode === ''} onChange={(e) => set('locality', e.target.value)}>
            <option value="">Elige una localidad</option>
            {form.locality && !localities.data?.includes(form.locality) && <option value={form.locality}>{form.locality}</option>}
            {localities.data?.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {text('phone', 'Teléfono')}
        {creating && (
          <Field label="Contraseña inicial (de 8 a 128 caracteres)" htmlFor="u-password">
            <input id="u-password" type="password" autoComplete="new-password" className={inputClass} value={form.password ?? ''} onChange={(e) => set('password', e.target.value)} />
          </Field>
        )}
      </div>
      <fieldset className="mt-4 space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Roles</legend>
        {ROLES.map((r) => (
          <label key={r.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.roles.includes(r.id)} onChange={() => toggleRole(r.id)} />
            <span>
              <span className="font-medium">{r.label}</span>
              <span className="block text-xs text-slate-500">{r.hint}</span>
            </span>
          </label>
        ))}
        <label className="flex items-center gap-2 pt-1 text-sm">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          <span className="font-medium">Cuenta activa</span>
        </label>
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button disabled={action.busy || form.roles.length === 0} onClick={() => void submit()}>
          {creating ? 'Crear la cuenta' : 'Guardar'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Notice message={action.message?.kind === 'error' ? action.message : null} />
      </div>
    </Panel>
  );
}

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ManagedUser | 'new' | null>(null);
  const [passwordOf, setPasswordOf] = useState<ManagedUser | null>(null);
  const size = 20;
  const users = useQuery({ queryKey: ['users', term, page], queryFn: () => fetchUsers(term, page, size) });
  const pages = Math.max(1, Math.ceil((users.data?.total ?? 0) / size));

  return (
    <Page title="Usuarios" intro="Las cuentas de Kuippo y sus roles. Los datos viven en el servicio de acceso; cada cambio queda en el historial.">
      <Panel
        title={`Cuentas${users.data ? ` (${users.data.total})` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(0);
                setTerm(search.trim());
              }}
            >
              <input aria-label="Buscar por nombre o correo" placeholder="Buscar por nombre o correo" className={`${inputClass} w-64`} value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>
            <Button onClick={() => { setPasswordOf(null); setEditing('new'); }}>Nueva cuenta</Button>
          </div>
        }
      >
        {users.isPending && <p className="text-sm text-slate-500">Cargando…</p>}
        {users.error && <Notice message={{ kind: 'error', text: 'No se pudieron cargar las cuentas.' }} />}
        {users.data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="eyebrow text-left">
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Correo</th>
                  <th className="px-3 py-2 font-medium">Roles</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {users.data.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2 font-medium">{fullName(u)}</td>
                    <td className="px-3 py-2">{u.email}</td>
                    <td className="px-3 py-2">{u.roles.map((r) => ROLES.find((x) => x.id === r)?.label ?? r).join(', ') || 'Sin rol'}</td>
                    <td className="px-3 py-2">{u.enabled ? 'Activa' : 'Desactivada'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" aria-label={`Editar ${fullName(u)}`} onClick={() => { setPasswordOf(null); setEditing(u); }}>
                          Editar
                        </Button>
                        <Button variant="secondary" aria-label={`Contraseña de ${fullName(u)}`} onClick={() => { setEditing(null); setPasswordOf(u); }}>
                          Contraseña
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.data.users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      No hay cuentas que coincidan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span>
              Página {page + 1} de {pages}
            </span>
            <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
              Siguiente
            </Button>
          </div>
        )}
      </Panel>

      {editing && <UserForm key={editing === 'new' ? 'new' : editing.id} user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {passwordOf && <PasswordForm key={passwordOf.id} user={passwordOf} onClose={() => setPasswordOf(null)} />}
    </Page>
  );
}
