import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * After Supabase redirects from invite/recovery emails, the session may arrive as:
 * - PKCE: ?code=... (query string)
 * - Implicit: #access_token=... (hash — client SDK often parses via detectSessionInUrl)
 *
 * Call once on invite/complete or reset-password mount before updateUser({ password }).
 */
export async function establishSessionFromAuthRedirect(
  supabase: SupabaseClient
): Promise<{ ok: boolean; errorMessage?: string }> {
  if (typeof window === 'undefined') {
    return { ok: false, errorMessage: 'This page must run in the browser.' };
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, errorMessage: error.message };
    }
    window.history.replaceState({}, document.title, url.pathname + url.hash);
    return { ok: true };
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    return { ok: false, errorMessage: error.message };
  }
  if (session) {
    return { ok: true };
  }

  await new Promise(r => setTimeout(r, 150));
  const { data: { session: s2 } } = await supabase.auth.getSession();
  if (s2) return { ok: true };

  await new Promise(r => setTimeout(r, 350));
  const { data: { session: s3 } } = await supabase.auth.getSession();
  if (s3) return { ok: true };

  return {
    ok: false,
    errorMessage:
      'This link is invalid or has expired. Request a new invite from your administrator or use Forgot password on the login page.',
  };
}
