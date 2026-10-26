/** Reads the realm roles from an access token (Keycloak's realm_access). The API checks them again on every call. */
export function rolesOf(accessToken: string | undefined): string[] {
  if (!accessToken) return [];
  try {
    const payload = accessToken.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { realm_access?: { roles?: string[] } };
    return claims.realm_access?.roles ?? [];
  } catch {
    return [];
  }
}

export const isAdmin = (accessToken: string | undefined) => rolesOf(accessToken).includes('admin');
