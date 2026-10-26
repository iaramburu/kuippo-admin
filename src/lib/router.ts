import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

window.addEventListener('popstate', notify);

/** Goes to a path without reloading, keeping the browser history. */
export function navigate(path: string, { replace = false }: { replace?: boolean } = {}) {
  if (path !== window.location.pathname) {
    if (replace) window.history.replaceState(null, '', path);
    else window.history.pushState(null, '', path);
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}
