import { useEffect, useRef, useState } from 'react';
import { useSessionUser } from '../auth/AuthGate';
import { signOut } from '../auth/oidc';
import { navigate, usePath } from '../lib/router';

/** 24x24 stroke icons, as in the customers' app. */
const ICONS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  account: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6',
  logout: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const ITEMS = [
  { path: '/account', label: 'Cuenta', icon: 'account' },
  { path: '/settings', label: 'Configuración', icon: 'settings' },
] as const;

/** The button of the header with "Cuenta", "Configuración" and "Cerrar sesión", as in the customers' app. */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePath().replace(/\/+$/, '');
  const user = useSessionUser();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100';
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de usuario"
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
      >
        <Icon name="menu" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {user?.profile.email && <p className="truncate px-3 py-2 text-xs text-slate-500">{user.profile.email}</p>}
          {ITEMS.map(({ path: to, label, icon }) => (
            <button
              key={to}
              type="button"
              role="menuitem"
              aria-current={path === to ? 'page' : undefined}
              className={`${item} ${path === to ? 'bg-brand-50 font-medium text-brand-700' : ''}`}
              onClick={() => {
                setOpen(false);
                navigate(to);
              }}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
          <button type="button" role="menuitem" className={item} onClick={() => void signOut()}>
            <Icon name="logout" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
