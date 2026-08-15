import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireApiAuth } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendSmtpMail, smtpErrorMessage } from '@/lib/smtp-mail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { key: 'bugtrack:send-resolved-email', limit: 20, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const auth = await requireApiAuth(req, ['admin']);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { email, bugId, bugTitle, reporterName } = body;

    if (
      typeof email !== 'string' || !EMAIL_RE.test(email) ||
      typeof bugId !== 'string' || !bugId.trim() ||
      typeof bugTitle !== 'string' || !bugTitle.trim() ||
      typeof reporterName !== 'string' || !reporterName.trim()
    ) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const subject = `[RESOLVED] Bug Report: ${bugTitle}`;
    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #059669; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">Bug Resolved</h1>
            <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Fortune BugTrack System</p>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <p>Hello ${reporterName},</p>
            <p>Good news! The bug you reported has been officially <strong>Resolved</strong> by our engineering team.</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; width: 120px;">Issue:</td>
                  <td style="padding: 4px 0; font-weight: 600;">${bugTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Bug ID:</td>
                  <td style="padding: 4px 0; font-family: monospace;">#${bugId.slice(0, 8).toUpperCase()}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 14px; line-height: 1.6;">
              Thank you for helping us keep the system running smoothly. You can log in and view the full details of the resolution on the BugTrack dashboard.
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/bugtrack/${bugId}" 
                 style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px; display: inline-block;">
                View Details
              </a>
            </div>
          </div>
          <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
            © ${new Date().getFullYear()} Fortune Procurement. All rights reserved.
          </div>
        </div>
      `;

    try {
      const result = await sendSmtpMail({
        to: email,
        subject,
        html: htmlContent,
        fromName: 'BugTrack System',
      });
      return NextResponse.json({ success: true, data: result });
    } catch (error: unknown) {
      return NextResponse.json(
        { success: false, data: { message: smtpErrorMessage(error) } },
        { status: 400 },
      );
    }
  } catch (error: unknown) {
    console.error('Resolved Email sending error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
