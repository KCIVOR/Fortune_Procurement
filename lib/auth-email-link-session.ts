import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';

const LINK_EXPIRED_MESSAGE =
  'This link is invalid or has expired. Request a new invite from your administrator or use Forgot password on the login page.';

/**
 * After Supabase redirects from invite/recovery emails, the session may arrive as:
 * - PKCE: ?code=... (query string)
 * - Implicit: #access_token=...&refresh_token=... (hash fragment)
 * - OTP: ?token_hash=...&type=invite|recovery (some email templates)
 *
 * The SSR browser client (`createBrowserClient`) stores sessions in cookies and does
 * not automatically consume hash fragments — we must handle all formats explicitly.
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

  const { data: { session: existingSession } } = await supabase.auth.getSession();
  if (existingSession) {
    return { ok: true };
  }

  // Implicit flow: #access_token=...&refresh_token=...
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      return { ok: false, errorMessage: error.message };
    }
    window.history.replaceState({}, document.title, url.pathname);
    return { ok: true };
  }

  // PKCE flow: ?code=...
  const code = url.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (
        error.message.includes('already') ||
        error.message.includes('expired') ||
        error.message.includes('invalid')
      ) {
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

  // Direct OTP link: ?token_hash=...&type=invite|recovery|signup
  const tokenHash = url.searchParams.get('token_hash');
  const otpType = url.searchParams.get('type');
  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });
    if (error) {
      return { ok: false, errorMessage: error.message };
    }
    window.history.replaceState({}, document.title, url.pathname);
    return { ok: true };
  }

  // Nothing recognizable in the URL — wait briefly in case another handler sets the session.
  return new Promise((resolve) => {
    let resolved = false;
    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 200;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (resolved) return;
      if (session) {
        resolved = true;
        subscription.unsubscribe();
        resolve({ ok: true });
      }
    });

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
        resolve({ ok: false, errorMessage: LINK_EXPIRED_MESSAGE });
        return;
      }

      setTimeout(checkSession, intervalMs);
    };

    setTimeout(checkSession, 100);

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription.unsubscribe();
        resolve({ ok: false, errorMessage: LINK_EXPIRED_MESSAGE });
      }
    }, 5000);
  });
}
