import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchParameters, resetParameter, setParameter } from './api';
import type { Parameter } from './types';

/** Every setting, with what applies now. */
export function useParameters() {
  return useQuery({ queryKey: ['parameters'], queryFn: fetchParameters });
}

export const parametersOf = (all: Parameter[] | undefined, scope: string) => (all ?? []).filter((p) => p.scope === scope);

/** Saving or restoring a setting refreshes the list and the history. */
export function useParameterWrites() {
  const client = useQueryClient();
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['parameters'] }), client.invalidateQueries({ queryKey: ['audit'] })]);
  return {
    save: async (scope: string, key: string, value: unknown) => {
      await setParameter(scope, key, value);
      await refresh();
    },
    reset: async (scope: string, key: string) => {
      await resetParameter(scope, key);
      await refresh();
    },
  };
}
