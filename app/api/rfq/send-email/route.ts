import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireApiAuth } from '@/lib/api-auth';

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
        const payload = {
          sender: { name: 'Fortune Procurement', email: 'johndaveb892@gmail.com' },
          to: [{ email }],
          subject: `RFQ Issued: ${rfqNumber}`,
          htmlContent: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 20px;">Request for Quotation</h1>
                <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Fortune Procurement System</p>
              </div>
              <div style="padding: 24px; color: #1e293b;">
                <p>Hello,</p>
                <p>You have been invited to submit a quotation for the following request:</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
                  <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 4px 0; color: #64748b; width: 120px;">RFQ Number:</td>
                      <td style="padding: 4px 0; font-weight: 600;">${rfqNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #64748b;">Department:</td>
                      <td style="padding: 4px 0;">${department ?? ''}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #64748b;">Purpose:</td>
                      <td style="padding: 4px 0;">${purpose ?? ''}</td>
                    </tr>
                    ${deadline ? `
                    <tr>
                      <td style="padding: 4px 0; color: #64748b;">Deadline:</td>
                      <td style="padding: 4px 0; color: #b91c1c; font-weight: 600;">${deadline}</td>
                    </tr>
                    ` : ''}
                  </table>
                </div>

                <div style="text-align: center; margin: 32px 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}${actionUrls[idx]}" 
                     style="background-color: #1e4bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px; display: inline-block;">
                    View & Submit Quotation
                  </a>
                </div>

                <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                  Please ensure your quotation is submitted before the deadline. If you have any questions, please contact the procurement department.
                </p>
              </div>
              <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} Fortune Procurement. All rights reserved.
              </div>
            </div>
          `,
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
