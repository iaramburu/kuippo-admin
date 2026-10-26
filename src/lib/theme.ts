import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

/** The same key as the customers' app; the choice is per browser and site, so it is stored again here. */
export const THEME_STORAGE_KEY = 'kuippo.theme';
export const DEFAULT_THEME: Theme = 'light';

const THEME_COLORS: Record<Theme, string> = { dark: '#101114', light: '#f4f4f7' };
const listeners = new Set<() => void>();

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the theme still applies for this session.
  }
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  return [theme, setTheme];
}
