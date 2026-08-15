import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthError, requireApiAuth } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import {
  loadSmtpSettings,
  publicSmtpView,
  smtpErrorMessage,
  verifySmtpSettings,
} from '@/lib/smtp-mail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server configuration error');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { key: 'admin:smtp-settings:get', limit: 30, windowMs: 5 * 60_000 });
  if (limited) return limited;

  const auth = await requireApiAuth(req, ['admin']);
  if (isAuthError(auth)) return auth;

  try {
    const row = await loadSmtpSettings();
    return NextResponse.json({ success: true, data: publicSmtpView(row) });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: smtpErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { key: 'admin:smtp-settings:put', limit: 20, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const auth = await requireApiAuth(req, ['admin']);
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const host = typeof body.host === 'string' ? body.host.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const fromEmail = typeof body.from_email === 'string' ? body.from_email.trim() : '';
    const fromName = typeof body.from_name === 'string' && body.from_name.trim()
      ? body.from_name.trim()
      : 'Fortune Procurement';
    const port = Number(body.port);
    const secure = body.secure === true || port === 465;
    const incomingPassword = typeof body.password === 'string' ? body.password : '';

    if (!host || !username || !fromEmail || !EMAIL_RE.test(fromEmail)) {
      return NextResponse.json({ success: false, error: 'Host, username, and a valid from email are required.' }, { status: 400 });
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return NextResponse.json({ success: false, error: 'Port must be an integer between 1 and 65535.' }, { status: 400 });
    }

    const existing = await loadSmtpSettings();
    const password = incomingPassword || existing?.password || '';
    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required for the first save.' }, { status: 400 });
    }

    await verifySmtpSettings({ host, port, secure, username, password });

    const admin = getServiceClient();
    const { error } = await admin
      .from('smtp_settings')
      .update({
        host,
        port,
        secure,
        username,
        password,
        from_email: fromEmail,
        from_name: fromName,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true);

    if (error) throw error;

    const saved = await loadSmtpSettings();
    return NextResponse.json({ success: true, data: publicSmtpView(saved) });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: smtpErrorMessage(error) },
      { status: 400 },
    );
  }
}
