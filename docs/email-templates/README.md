# Fortune Procurement Email Templates

Corporate-branded email templates aligned with the Fortune Procurement design system.

## Templates Included

| Template | File | Purpose |
|----------|------|---------|
| Confirm Signup | `confirm-signup.html` | Email verification for new account signups |
| Invite User | `invite-user.html` | Admin-initiated user invitations |
| Reset Password | `reset-password.html` | Password reset requests |

## Design System Alignment

These templates use the official Fortune Procurement design tokens:

- **Primary Brand**: `#1a4480` (primary-600), `#0a1628` (primary-900)
- **Danger/Security**: `#dc2626` (danger-600) — used for password reset
- **Typography**: Inter, Segoe UI, system-ui font stack
- **Layout**: 600px max-width, 12px border radius cards
- **Header**: Dark gradient (primary-900 → primary-600) with FPC logo badge

## How to Apply in Supabase

1. Open your Supabase Dashboard
2. Navigate to **Authentication → Email Templates**
3. For each template:
   - Select the corresponding template type (Confirm signup, Invite user, Reset password)
   - Copy the HTML content from the respective file
   - Paste into the email body editor
   - Save changes

## Template Variables

All templates use Supabase's standard email variables:
- `{{ .ConfirmationURL }}` — The action URL (verification, invite acceptance, password reset)
- `{{ .SiteURL }}` — Your configured site URL (used in signup confirmation footer)
- `{{ .Email }}` — The recipient's email address (optional)
- `{{ .Token }}` — The OTP token (optional, not used in these templates)

## Subject Line Recommendations

| Template | Suggested Subject |
|----------|-------------------|
| Confirm Signup | `Confirm your Fortune Procurement account` |
| Invite User | `You've been invited to Fortune Procurement` |
| Reset Password | `Reset your Fortune Procurement password` |

## Features

✅ **Mobile responsive** — Tested across major email clients  
✅ **Brand consistent** — Uses official design tokens  
✅ **Accessible** — Semantic HTML, proper contrast ratios  
✅ **Fallback link** — Plain URL provided in case button fails  
✅ **Security notices** — Each template includes appropriate warnings  
✅ **Professional tone** — Corporate language throughout  

## Customization

To modify the templates while maintaining design consistency:

- **Brand colors**: Use values from `app/tokens.css`
- **Typography**: Stick to the Inter font stack
- **Spacing**: Use 8px increments (sp-2, sp-4, sp-6, sp-8)
- **Border radius**: 8px for buttons, 12px for containers

## Testing

Before deploying, test the emails by:
1. Sending a test invite from the admin panel
2. Triggering a password reset from the login page
3. Checking the rendered email in:
   - Gmail (web + mobile)
   - Outlook (web + desktop)
   - Apple Mail
