import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ApiError } from '../lib/api';
import type { Parameter } from '../lib/types';

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60';

const buttonClasses = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50',
} as const;

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonClasses }) {
  return <button type="button" {...rest} className={`rounded-xl px-4 py-2 text-sm font-semibold ${buttonClasses[variant]} ${className}`} />;
}

export function Panel({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export type Message = { kind: 'ok' | 'error'; text: string } | null;

export function Notice({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role={message.kind === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-3 py-2 text-sm ${message.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
    >
      {message.text}
    </p>
  );
}

/** What an API call says when it fails, in words for the person using the page. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.status === 403 ? 'Tu sesión no tiene permiso para esto. Vuelve a entrar.' : error.message;
  return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
}

/** A call that shows its result: `run` wraps a promise and sets the message. */
export function useAction() {
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'ok', text: done });
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };
  return { message, busy, run, clear: () => setMessage(null) };
}

const dateTime = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** Whether the setting runs on its default or was changed, and by whom. */
export function Origin({ parameter }: { parameter: Parameter }) {
  return parameter.overridden && parameter.updatedAt ? (
    <p className="text-xs text-violet-700">
      Modificado por {parameter.updatedBy || 'alguien'} el {formatDateTime(parameter.updatedAt)}
    </p>
  ) : (
    <p className="text-xs text-slate-500">Valor por defecto</p>
  );
}

export function Page({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="page space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {intro && <p className="mt-1 max-w-3xl text-sm text-slate-600">{intro}</p>}
      </div>
      {children}
    </div>
  );
}
