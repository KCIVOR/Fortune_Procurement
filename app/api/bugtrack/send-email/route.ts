import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bugTitle, bugDescription, severity, location, reporterName } = body;

    const { data: settings } = await supabase
      .from('bugtrack_settings')
      .select('notification_email')
      .single();
    const email = (settings as { notification_email?: string } | null)?.notification_email;

    if (!email) {
      console.log('No bugtrack notification email configured.');
      return NextResponse.json({ success: true, message: 'No notification email configured.' });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    const payload = {
      sender: { name: "BugTrack System", email: "johndaveb892@gmail.com" },
      to: [{ email }],
      subject: `[${severity.toUpperCase()} SEVERITY] New Bug Reported: ${bugTitle}`,
      htmlContent: `
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
      `,
    };

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY || '',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    
    if (!res.ok) {
      return NextResponse.json({ success: false, data }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('BugTrack Email sending error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
