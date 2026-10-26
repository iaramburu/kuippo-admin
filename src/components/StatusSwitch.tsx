import type { ReactNode } from 'react';

type Glyph = 'unlock' | 'lock' | 'shield-check' | 'shield-off';

const PATHS: Record<Glyph, ReactNode> = {
  // an open and a closed padlock
  unlock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  // a shield with a tick, and a crossed-out one
  'shield-check': (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.4 2.4 4.2-4.6" />
    </>
  ),
  'shield-off': (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m9 9 6 6m0-6-6 6" />
    </>
  ),
};

function Icon({ glyph }: { glyph: Glyph }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[glyph]}
    </svg>
  );
}

/**
 * An on/off switch that says its state in words, colour and a picture: green with the "on" icon, or red with the "off" one.
 * `on` undefined is "not known yet" (neutral, disabled).
 */
export function StatusSwitch(props: {
  label: string;
  on: boolean | undefined;
  onText: string;
  offText: string;
  onGlyph: Glyph;
  offGlyph: Glyph;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const known = props.on !== undefined;
  const tone = !known
    ? 'border-slate-300 bg-slate-50 text-slate-500'
    : props.on
      ? 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
      : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on === true}
      aria-label={props.label}
      disabled={props.disabled || !known}
      onClick={props.onToggle}
      className={`flex min-w-32 items-center justify-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${tone}`}
    >
      {known && <Icon glyph={props.on ? props.onGlyph : props.offGlyph} />}
      <span>{!known ? '…' : props.on ? props.onText : props.offText}</span>
    </button>
  );
}
