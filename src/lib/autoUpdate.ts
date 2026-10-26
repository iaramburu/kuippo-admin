import { useEffect, useRef } from 'react';

// Keeping the site up to date by itself. A deployment is picked up wherever the site is open (any browser or device),
// with no notice and nothing asked; the only care is not to reload the page under whoever is writing something.

/** How often the open site asks whether there is a new version (the file is a few bytes). */
export const CHECK_EVERY_MS = 15 * 60_000;
/** A page this young has nothing in it worth keeping: a new version is applied at once. */
export const FRESH_MS = 15_000;
/** Back from another window or app after this long, the new version is applied (and checked for, whatever the time away). */
export const AWAY_MS = 5_000;

/** The session key that remembers the version the page was reloaded for, so a version that does not stick cannot reload forever. */
export const RELOADED_KEY = 'kuippo.admin.reloadedFor';

/** Whether the version that is published is another one than the version that is running (and was not already tried). */
export function shouldReload(published: string | null | undefined, running: string, reloadedFor: string | null): published is string {
  return !!published && published !== running && published !== reloadedFor;
}

/** Whether the person is typing in a field (a reload would lose what they write). */
export function isTyping(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (element as HTMLElement).isContentEditable === true;
}

/** The version of the published build, or null when it cannot be known (no connection, the development server). */
export async function fetchPublishedVersion(): Promise<string | null> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === 'string' && body.version !== '' ? body.version : null;
  } catch {
    return null;
  }
}

export function readReloadedFor(): string | null {
  try {
    return window.sessionStorage.getItem(RELOADED_KEY);
  } catch {
    return null;
  }
}

export function rememberReloadFor(version: string): void {
  try {
    window.sessionStorage.setItem(RELOADED_KEY, version);
  } catch {
    // without storage a version that does not stick could reload more than once: checks are minutes apart, so it is slow, not a loop
  }
}

/**
 * Calls `apply` at the first moment that is safe once there is something `pending`: when the page has just opened, when the
 * person comes back to it, when they move to another screen, or when they leave it (the page is hidden). Never while they are
 * on a screen of `editing`, nor after they have written anything on the screen they are on (then only moving to another one
 * applies it): a form half filled is never lost. `check` is asked on opening, every CHECK_EVERY_MS, and when they come back.
 */
export function useUpdateWhenSafe(options: { pending: boolean; editing: boolean; path: string; check: () => void | Promise<void>; apply: () => void }) {
  const latest = useRef(options);
  latest.current = options;
  const openedAt = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);
  // Whether the person has written in a field of the screen they are on (reset when they move to another one)
  const written = useRef(false);

  const tryApply = (leaving = false) => {
    const { pending, editing, apply } = latest.current;
    if (!pending || editing || written.current || (!leaving && isTyping(document.activeElement))) return;
    apply();
  };

  useEffect(() => {
    void latest.current.check();
    const timer = window.setInterval(() => void latest.current.check(), CHECK_EVERY_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        // leaving: nobody is looking at the page, and a field that still has the focus has been left too
        tryApply(true);
        return;
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      void Promise.resolve(latest.current.check()).then(() => {
        if (away >= AWAY_MS || Date.now() - openedAt.current < FRESH_MS) tryApply();
      });
    };
    // a page restored from the back-forward cache is as old as the day it was left
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void latest.current.check();
    };
    const onInput = () => {
      written.current = true;
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('input', onInput, true);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('input', onInput, true);
      window.removeEventListener('pageshow', onPageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Something became pending, or the person moved to another screen (or left one for writing). Moving to another screen is a safe
  // moment; a version that arrives while the person is looking at a page that is not young waits for the next one.
  const previousPath = useRef(options.path);
  useEffect(() => {
    const moved = previousPath.current !== options.path;
    previousPath.current = options.path;
    if (moved) written.current = false;
    if (!options.pending) return;
    if (moved) tryApply();
    else if (Date.now() - openedAt.current < FRESH_MS || document.visibilityState === 'hidden') tryApply(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.pending, options.path, options.editing]);
}
