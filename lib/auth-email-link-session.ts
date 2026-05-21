import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * After Supabase redirects from invite/recovery emails, the session may arrive as:
 * - PKCE: ?code=... (query string)
 * - Implicit: #access_token=... (hash — client SDK often parses via detectSessionInUrl)
 *
 * Since detectSessionInUrl: true is set in the Supabase client, the SDK automatically
 * processes the URL parameters and strips them. We need to wait for that process to complete.
 *
 * Call once on invite/complete or reset-password mount before updateUser({ password }).
 */
export async function establishSessionFromAuthRedirect(
  supabase: SupabaseClient
): Promise<{ ok: boolean; errorMessage?: string }> {
  if (typeof window === 'undefined') {
    return { ok: false, errorMessage: 'This page must run in the browser.' };
  }

  // First, check if we already have a session (detectSessionInUrl may have already processed it)
  const { data: { session: existingSession } } = await supabase.auth.getSession();
  if (existingSession) {
    return { ok: true };
  }

  // Check if there's a code in the URL that we need to exchange manually
  // (This handles cases where detectSessionInUrl didn't process it yet)
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');

  if (code) {
    // Try to exchange the code manually
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // If the code was already used (by detectSessionInUrl), check for session again
      if (error.message.includes('already') || error.message.includes('expired') || error.message.includes('invalid')) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.history.replaceState({}, document.title, url.pathname);
          return { ok: true };
        }
      }
      return { ok: false, errorMessage: error.message };
    }
    window.history.replaceState({}, document.title, url.pathname);
    return { ok: true };
  }

  // No code in URL - detectSessionInUrl likely already processed it
  // Wait for the auth state to settle using onAuthStateChange
  return new Promise((resolve) => {
    let resolved = false;
    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 200;

    // Listen for auth state changes (session becoming available)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;
      
      if (session) {
        resolved = true;
        subscription.unsubscribe();
        resolve({ ok: true });
      }
    });

    // Also poll getSession as a fallback
    const checkSession = async () => {
      if (resolved) return;
      
      attempts++;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        resolved = true;
        subscription.unsubscribe();
        resolve({ ok: true });
        return;
      }

      if (attempts >= maxAttempts) {
        resolved = true;
        subscription.unsubscribe();
        resolve({
          ok: false,
          errorMessage:
            'This link is invalid or has expired. Request a new invite from your administrator or use Forgot password on the login page.',
        });
        return;
      }

      // Continue polling
      setTimeout(checkSession, intervalMs);
    };

    // Start polling after a short delay to let detectSessionInUrl finish
    setTimeout(checkSession, 100);

    // Safety timeout - don't wait forever
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription.unsubscribe();
        resolve({
          ok: false,
          errorMessage:
            'This link is invalid or has expired. Request a new invite from your administrator or use Forgot password on the login page.',
        });
      }
    }, 5000);
  });
}
