import type { User } from 'oidc-client-ts';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import logo from '../assets/kuippo_full.svg';
import { Button } from '../components/ui';
import { setSessionLostHandler } from '../lib/api';
import { isAdmin } from './claims';
import { initAuth, signIn, signOut, userManager } from './oidc';

type State = 'loading' | 'redirecting' | 'forbidden' | 'failed' | 'ready';

const SessionContext = createContext<User | null>(null);
export const useSessionUser = () => useContext(SessionContext);

function Shell({ children }: { children: ReactNode }) {
  // The same page as the customers' app (logo, the gradient line on top, a narrow column)
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <span aria-hidden="true" className="brand-line fixed inset-x-0 top-0" />
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="flex justify-center">
          <img src={logo} alt="Kuippo" className="h-16 w-auto" />
        </h1>
        {children}
      </div>
    </main>
  );
}

/**
 * Nothing of the admin site is shown until there is a session of an administrator. Without a session the person goes straight to
 * Keycloak's sign-in page (there is no page of our own to click through); with one, any address (/login included) leads into the
 * site. Only a failure to sign in, or an account that is not an administrator, shows a page here.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('loading');
  const [user, setUser] = useState<User | null>(null);

  const toKeycloak = () => {
    setState('redirecting');
    // /login is where the site is while it leaves for Keycloak's page, and where somebody without a session lands
    window.history.replaceState(null, '', '/login');
    signIn().catch(() => setState('failed'));
  };

  const accept = (next: User | null) => {
    setUser(next);
    if (!next) toKeycloak();
    else setState(isAdmin(next.access_token) ? 'ready' : 'forbidden');
  };

  useEffect(() => {
    initAuth().then(accept, () => setState('failed'));
    // A renewed token carries the roles as they are now: a removed role closes the door within minutes.
    const renewed = (next: User) => accept(next);
    userManager.events.addUserLoaded(renewed);
    setSessionLostHandler(() => accept(null));
    return () => userManager.events.removeUserLoaded(renewed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'loading' || state === 'redirecting')
    return (
      <Shell>
        <p role="status" className="text-sm text-slate-500">
          {state === 'redirecting' ? 'Abriendo el acceso…' : 'Cargando…'}
        </p>
      </Shell>
    );
  if (state === 'failed')
    return (
      <Shell>
        <p role="alert" className="text-sm text-red-700">
          No se pudo completar el acceso.
        </p>
        <Button onClick={toKeycloak}>Intentarlo de nuevo</Button>
      </Shell>
    );
  if (state === 'forbidden')
    return (
      <Shell>
        <p role="alert" className="text-sm text-red-700">
          Esta cuenta no es administradora.
        </p>
        <Button variant="secondary" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </Shell>
    );
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}
