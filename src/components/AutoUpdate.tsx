import { useState } from 'react';
import { fetchPublishedVersion, readReloadedFor, rememberReloadFor, shouldReload, useUpdateWhenSafe } from '../lib/autoUpdate';
import { usePath } from '../lib/router';

/**
 * Reloads the site by itself when there is a new deployment, without asking and without a notice, whatever the browser or the
 * device. The session is kept in the browser, so the person stays signed in. See lib/autoUpdate.ts.
 */
export function AutoUpdate() {
  const path = usePath();
  const [published, setPublished] = useState<string | null>(null);
  useUpdateWhenSafe({
    pending: shouldReload(published, __APP_VERSION__, readReloadedFor()),
    editing: false,
    path,
    check: async () => setPublished(await fetchPublishedVersion()),
    apply: () => {
      if (published) rememberReloadFor(published);
      window.location.reload();
    },
  });
  return null;
}
