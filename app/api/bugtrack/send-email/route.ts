import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthError, requireApiAuth } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendSmtpMail, smtpErrorMessage } from '@/lib/smtp-mail';

const SEVERITIES = new Set(['low', 'medium', 'high']);

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { key: 'bugtrack:send-email', limit: 20, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const auth = await requireApiAuth(req);
    if (isAuthError(auth)) return auth;

    const body = await req.json();
    const { bugTitle, bugDescription, severity, location, reporterName } = body;

    if (
      typeof bugTitle !== 'string' || !bugTitle.trim() ||
      typeof bugDescription !== 'string' || !bugDescription.trim() ||
      typeof severity !== 'string' || !SEVERITIES.has(severity) ||
      typeof location !== 'string' || !location.trim() ||
      typeof reporterName !== 'string' || !reporterName.trim()
    ) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 },
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: settings } = await admin
      .from('bugtrack_settings')
      .select('notification_email')
      .single();
    const email = (settings as { notification_email?: string } | null)?.notification_email;

    if (!email) {
      return NextResponse.json({ success: true, message: 'No notification email configured.' });
    }

    const subject = `[${severity.toUpperCase()} SEVERITY] New Bug Reported: ${bugTitle}`;
    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">New Bug Report</h1>
            <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Fortune BugTrack System</p>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <p>A new issue has been logged in the system.</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; width: 120px;">Issue:</td>
                  <td style="padding: 4px 0; font-weight: 600;">${bugTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Severity:</td>
                  <td style="padding: 4px 0;">
                    <span style="background-color: ${severity === 'high' ? '#fee2e2' : severity === 'medium' ? '#fef3c7' : '#dbeafe'}; color: ${severity === 'high' ? '#b91c1c' : severity === 'medium' ? '#b45309' : '#1d4ed8'}; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                      ${severity}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Location:</td>
                  <td style="padding: 4px 0;">${location}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Reported By:</td>
                  <td style="padding: 4px 0;">${reporterName}</td>
                </tr>
              </table>
            </div>

            <div style="margin: 24px 0;">
              <h3 style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Description</h3>
              <div style="background-color: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px; font-size: 14px; white-space: pre-wrap;">${bugDescription}</div>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/bugtrack" 
                 style="background-color: #1e4bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px; display: inline-block;">
                View in BugTrack
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
    console.error('BugTrack Email sending error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
