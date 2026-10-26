import { Page, Panel } from '../components/ui';
import { useTheme, type Theme } from '../lib/theme';

const OPTIONS: { id: Theme; label: string; description: string }[] = [
  { id: 'light', label: 'Gris claro', description: 'Predeterminado' },
  { id: 'dark', label: 'Gris oscuro', description: 'Más tenue' },
];

/** What is set on this device, as in the customers' app (which also offers to install itself; this site is not an installable app). */
export function SettingsPage() {
  const [theme, setTheme] = useTheme();
  return (
    <Page title="Configuración">
      <Panel title="Apariencia" subtitle="El tema se guarda en este dispositivo.">
        <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map(({ id, label, description }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              onClick={() => setTheme(id)}
              className={`rounded-xl border-2 p-3 text-left ${theme === id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <span aria-hidden="true" className="mb-2 block h-10 rounded-lg border border-slate-300" style={{ background: id === 'dark' ? '#101114' : '#f4f4f7' }} />
              <span className="block font-medium">{label}</span>
              <span className="block text-xs text-slate-500">{description}</span>
            </button>
          ))}
        </div>
      </Panel>
    </Page>
  );
}
