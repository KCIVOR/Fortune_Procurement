import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rfqId, rfqNumber, department, purpose, deadline, supplierEmails, actionUrls } = body;

    console.log('--- Email API Triggered ---');
    console.log('RFQ Number:', rfqNumber);
    console.log('Suppliers to notify:', supplierEmails);

    if (!supplierEmails || supplierEmails.length === 0) {
      console.log('Result: No supplier emails provided.');
      return NextResponse.json({ success: true, message: 'No suppliers to notify.' });
    }

    const results = await Promise.all(
      supplierEmails.map(async (email: string, idx: number) => {
        const res = await resend.emails.send({
          from: 'Fortune Procurement <onboarding@resend.dev>', // Use verified domain in production
          to: email,
          subject: `RFQ Issued: ${rfqNumber}`,
          html: `
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
                      <td style="padding: 4px 0;">${department}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #64748b;">Purpose:</td>
                      <td style="padding: 4px 0;">${purpose}</td>
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
        });
        console.log(`Resend response for ${email}:`, res);
        return res;
      })
    );

    const hasError = results.some(r => r.error);
    if (hasError) {
      return NextResponse.json({ success: false, results }, { status: 400 });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Email sending error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
