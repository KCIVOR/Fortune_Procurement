import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireApiAuth } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidRfqEmailBody(body: unknown): body is {
  rfqNumber: string;
  supplierEmails: string[];
  actionUrls: string[];
  rfqId?: string;
  department?: string;
  purpose?: string;
  deadline?: string | null;
} {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (typeof b.rfqNumber !== 'string' || !b.rfqNumber.trim()) return false;
  if (!Array.isArray(b.supplierEmails) || !Array.isArray(b.actionUrls)) return false;
  if (b.supplierEmails.length !== b.actionUrls.length) return false;
  if (!b.supplierEmails.every((e) => typeof e === 'string' && EMAIL_RE.test(e))) return false;
  if (!b.actionUrls.every((u) => typeof u === 'string' && u.startsWith('/'))) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { key: 'rfq:send-email', limit: 20, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const auth = await requireApiAuth(req, ['procurement']);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    if (!isValidRfqEmailBody(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 },
      );
    }

    const { rfqNumber, department, purpose, deadline, supplierEmails, actionUrls } = body;

    if (supplierEmails.length === 0) {
      return NextResponse.json({ success: true, message: 'No suppliers to notify.' });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    const results = await Promise.all(
      supplierEmails.map(async (email: string, idx: number) => {
        const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}${actionUrls[idx]}`;
        const payload = {
          sender: { name: 'Fortune Procurement', email: 'johndaveb892@gmail.com' },
          to: [{ email }],
          subject: `RFQ Issued: ${rfqNumber}`,
          htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Request for Quotation | Fortune Procurement</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;color:#111827;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07),0 2px 4px rgba(0,0,0,.06);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a1628 0%,#1a4480 100%);padding:40px 30px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:#ffffff;width:56px;height:56px;border-radius:12px;text-align:center;line-height:56px;margin-bottom:16px;">
                      <span style="font-size:24px;font-weight:700;color:#1a4480;letter-spacing:-0.5px;">FPC</span>
                    </div>
                    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;letter-spacing:-0.3px;">Fortune Procurement</h1>
                    <p style="color:#bfdbfe;margin:8px 0 0 0;font-size:13px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">Procurement System</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 40px 32px 40px;">
              <h2 style="margin:0 0 16px 0;color:#111827;font-size:22px;font-weight:600;letter-spacing:-0.3px;">Request for Quotation</h2>
              <p style="font-size:15px;color:#4b5563;line-height:1.6;margin:0 0 16px 0;">
                Hello, you have been invited to submit a quotation for the following procurement request. Please review the details below and respond before the deadline.
              </p>

              <!-- RFQ Details -->
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:0 0 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;width:130px;font-weight:500;">RFQ Number</td>
                    <td style="padding:6px 0;color:#111827;font-weight:700;">${rfqNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-weight:500;">Department</td>
                    <td style="padding:6px 0;color:#111827;">${department ?? '—'}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-weight:500;">Purpose</td>
                    <td style="padding:6px 0;color:#111827;">${purpose ?? '—'}</td>
                  </tr>
                  ${deadline ? `
                  <tr>
                    <td style="padding:6px 0;color:#6b7280;font-weight:500;">Deadline</td>
                    <td style="padding:6px 0;color:#b91c1c;font-weight:700;">${deadline}</td>
                  </tr>` : ''}
                </table>
              </div>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px 0;">
                    <a href="${actionUrl}" style="background:#1a4480;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;letter-spacing:0.2px;box-shadow:0 1px 3px rgba(0,0,0,.10),0 1px 2px rgba(0,0,0,.06);">
                      View &amp; Submit Quotation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 24px 0;">
                <p style="font-size:12px;color:#6b7280;line-height:1.5;margin:0 0 8px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Button not working?</p>
                <p style="font-size:13px;color:#4b5563;line-height:1.5;margin:0;word-break:break-all;">
                  Copy and paste this link into your browser:<br>
                  <a href="${actionUrl}" style="color:#1a4480;text-decoration:underline;">${actionUrl}</a>
                </p>
              </div>

              <!-- Notice -->
              <div style="border-left:3px solid #1a4480;padding:12px 16px;background:#eff6ff;border-radius:0 6px 6px 0;">
                <p style="font-size:13px;color:#103058;line-height:1.5;margin:0;">
                  <strong>Notice:</strong> Please ensure your quotation is submitted before the deadline. If you have any questions, contact the procurement department directly.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <p style="font-size:12px;color:#6b7280;margin:0 0 8px 0;line-height:1.5;">
                      This is an automated message from Fortune Procurement.<br>
                      Please do not reply to this email.
                    </p>
                    <p style="font-size:11px;color:#9ca3af;margin:8px 0 0 0;letter-spacing:0.3px;">
                      © ${new Date().getFullYear()} Fortune Procurement. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        };

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': BREVO_API_KEY || '',
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        return {
          email,
          success: res.ok,
          data,
          error: !res.ok ? data : null,
        };
      }),
    );

    const hasError = results.some((r) => !r.success);
    if (hasError) {
      return NextResponse.json({ success: false, results }, { status: 400 });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    console.error('Email sending error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
