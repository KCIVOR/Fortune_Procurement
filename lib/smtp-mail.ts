import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export type SmtpSettingsRow = {
  host: string | null;
  port: number;
  secure: boolean;
  username: string | null;
  password: string | null;
  from_email: string | null;
  from_name: string | null;
};

export type SendSmtpMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;
};

export type SendSmtpMailResult = {
  messageId: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Server configuration error');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function loadSmtpSettings(): Promise<SmtpSettingsRow | null> {
  const admin = getServiceClient();
  const { data, error } = await admin
    .from('smtp_settings')
    .select('host, port, secure, username, password, from_email, from_name')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return (data as SmtpSettingsRow | null) ?? null;
}

export function assertSmtpReady(row: SmtpSettingsRow | null): asserts row is SmtpSettingsRow & {
  host: string;
  username: string;
  password: string;
  from_email: string;
} {
  if (!row?.host?.trim() || !row.username?.trim() || !row.password || !row.from_email?.trim()) {
    throw new Error('SMTP is not configured. An admin must save SMTP settings.');
  }
}

export async function verifySmtpSettings(row: {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: row.host,
    port: row.port,
    secure: row.secure || row.port === 465,
    auth: { user: row.username, pass: row.password },
  });
  await transporter.verify();
}

export async function sendSmtpMail(input: SendSmtpMailInput): Promise<SendSmtpMailResult> {
  const row = await loadSmtpSettings();
  assertSmtpReady(row);

  const transporter = nodemailer.createTransport({
    host: row.host,
    port: row.port,
    secure: row.secure || row.port === 465,
    auth: { user: row.username, pass: row.password },
  });

  const fromName = input.fromName || row.from_name || 'Fortune Procurement';
  const to = Array.isArray(input.to) ? input.to.join(', ') : input.to;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${row.from_email}>`,
    to,
    subject: input.subject,
    html: input.html,
  });

  return { messageId: info.messageId || 'unknown' };
}

export function smtpErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Failed to send email';
}

export function publicSmtpView(row: SmtpSettingsRow | null) {
  return {
    host: row?.host ?? '',
    port: row?.port ?? 587,
    secure: row?.secure ?? false,
    username: row?.username ?? '',
    from_email: row?.from_email ?? '',
    from_name: row?.from_name ?? 'Fortune Procurement',
    password_set: Boolean(row?.password),
  };
}
