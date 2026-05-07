/**
 * Absolute app origin for Supabase Auth redirectTo (invite + password recovery).
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://app.example.com).
 * APP_URL is supported as an alternate server-only name.
 */
export function getServerAppUrl(): string {
  const fromPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromPublic) return fromPublic.replace(/\/$/, '');

  const fromApp = process.env.APP_URL?.trim();
  if (fromApp) return fromApp.replace(/\/$/, '');

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;

  return 'http://localhost:3000';
}
