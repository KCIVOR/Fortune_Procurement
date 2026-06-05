import { supabase } from '@/lib/supabase';

/** Headers with Bearer token for protected `/api/*` routes. */
export async function getAuthHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Not authenticated');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

/** `fetch` to same-origin API routes with session Bearer token. */
export async function authFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }
  return fetch(url, { ...init, headers });
}
