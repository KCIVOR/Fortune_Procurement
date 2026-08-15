import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireApiAuth } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendSmtpMail, smtpErrorMessage } from '@/lib/smtp-mail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: 'admin:smtp-settings:test', limit: 10, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const auth = await requireApiAuth(req, ['admin']);
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const to = typeof body.to === 'string' ? body.to.trim() : '';

    if (!to || !EMAIL_RE.test(to)) {
      return NextResponse.json(
        { success: false, error: 'A valid test recipient email is required.' },
        { status: 400 },
      );
    }

    const result = await sendSmtpMail({
      to,
      subject: 'Fortune Procurement — SMTP test',
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: auto; color: #1e293b;">
          <h2 style="margin: 0 0 12px;">SMTP test successful</h2>
          <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.5;">
            This message confirms that the Procurement System can send email using the SMTP settings saved in Admin → System Settings.
          </p>
          <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">
            Sent at ${new Date().toISOString()}
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: smtpErrorMessage(error) },
      { status: 400 },
    );
  }
}
