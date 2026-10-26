import { useEffect, type ReactNode } from 'react';
import logo from './assets/kuippo_full.svg';
import { useSessionUser } from './auth/AuthGate';
import { signOut } from './auth/oidc';
import { navigate, usePath } from './lib/router';
import { CalendarPage } from './pages/CalendarPage';
import { FlagsPage } from './pages/FlagsPage';
import { HistoryPage } from './pages/HistoryPage';
import { LimitsPage } from './pages/LimitsPage';
import { MailPage } from './pages/MailPage';
import { SocialSecurityPage } from './pages/SocialSecurityPage';
import { UsersPage } from './pages/UsersPage';

const SECTIONS: { path: string; label: string; view: () => ReactNode }[] = [
  { path: '/users', label: 'Usuarios', view: UsersPage },
  { path: '/social-security', label: 'Seguridad Social', view: SocialSecurityPage },
  { path: '/calendar', label: 'Calendario fiscal', view: CalendarPage },
  { path: '/limits', label: 'Límites de uso', view: LimitsPage },
  { path: '/flags', label: 'Funciones', view: FlagsPage },
  { path: '/mail', label: 'Plantillas de correo', view: MailPage },
  { path: '/history', label: 'Historial', view: HistoryPage },
];

export default function App() {
  const path = usePath().replace(/\/+$/, '') || '/';
  const user = useSessionUser();
  const section = SECTIONS.find((s) => s.path === path);
  // A page is a component of its own (it has its own hooks): it is rendered, never called from here.
  const View = section?.view;

  // The start page, and any address that is not a section, go to the first one.
  useEffect(() => {
    if (!section) navigate(SECTIONS[0]!.path, { replace: true });
  }, [section]);

  const link = (s: (typeof SECTIONS)[number], mobile: boolean) => (
    <a
      key={s.path}
      href={s.path}
      aria-current={s.path === path ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault();
        navigate(s.path);
      }}
      className={
        mobile
          ? `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${s.path === path ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`
          : `block rounded-lg px-3 py-2 text-sm ${s.path === path ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`
      }
    >
      {s.label}
    </a>
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-2 backdrop-blur-md" style={{ background: 'var(--app-header)', borderColor: 'var(--app-line)' }}>
        <img src={logo} alt="Kuippo" className="h-8 w-auto" />
        <span className="eyebrow hidden sm:inline">Administración</span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-slate-600 sm:inline">{user?.profile.email}</span>
          <button type="button" onClick={() => void signOut()} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
            Cerrar sesión
          </button>
        </div>
        <span aria-hidden="true" className="brand-line absolute inset-x-0 bottom-0" />
      </header>
      <div className="md:flex">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r p-4 md:block" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-line)' }}>
          <nav aria-label="Secciones" className="space-y-1">
            {SECTIONS.map((s) => link(s, false))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto border-b px-4 py-2 md:hidden" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-line)' }}>
            {SECTIONS.map((s) => link(s, true))}
          </nav>
          <main>{View ? <View /> : null}</main>
        </div>
      </div>
    </div>
  );
}
