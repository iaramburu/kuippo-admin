import type { User } from 'oidc-client-ts';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import logo from '../assets/kuippo_full.svg';
import { Button } from '../components/ui';
import { setSessionLostHandler } from '../lib/api';
import { isAdmin } from './claims';
import { initAuth, signIn, signOut, userManager } from './oidc';

type State = 'loading' | 'anonymous' | 'forbidden' | 'failed' | 'ready';

const SessionContext = createContext<User | null>(null);
export const useSessionUser = () => useContext(SessionContext);

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <img src={logo} alt="Kuippo" className="h-10 w-auto" />
      <span aria-hidden="true" className="brand-line w-full rounded-full" />
      {children}
    </main>
  );
}

/** Nothing of the back office is shown until there is a session of an administrator. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('loading');
  const [user, setUser] = useState<User | null>(null);

  const accept = (next: User | null) => {
    setUser(next);
    setState(!next ? 'anonymous' : isAdmin(next.access_token) ? 'ready' : 'forbidden');
  };

  useEffect(() => {
    initAuth().then(accept, () => setState('failed'));
    // A renewed token carries the roles as they are now: a removed role closes the door within minutes.
    const renewed = (next: User) => accept(next);
    userManager.events.addUserLoaded(renewed);
    setSessionLostHandler(() => accept(null));
    return () => userManager.events.removeUserLoaded(renewed);
  }, []);

  if (state === 'loading') return <Shell><p className="text-sm text-slate-500">Cargando…</p></Shell>;
  if (state === 'failed')
    return (
      <Shell>
        <p role="alert" className="text-sm text-red-700">No se pudo completar el acceso.</p>
        <Button onClick={() => void signIn()}>Intentarlo de nuevo</Button>
      </Shell>
    );
  if (state === 'anonymous')
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Administración de Kuippo</h1>
        <p className="text-sm text-slate-600">El acceso pide tu contraseña y el código de tu aplicación de autenticación.</p>
        <Button onClick={() => void signIn()}>Entrar</Button>
      </Shell>
    );
  if (state === 'forbidden')
    return (
      <Shell>
        <p role="alert" className="text-sm text-red-700">Esta cuenta no es administradora.</p>
        <Button variant="secondary" onClick={() => void signOut()}>Cerrar sesión</Button>
      </Shell>
    );
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}
