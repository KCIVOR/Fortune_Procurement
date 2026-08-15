# Brevo → SMTP Email Migration — Surgical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Brevo REST API email delivery with SMTP for app-triggered emails (bug notifications + RFQ invitations). Admins configure SMTP on **System Settings**. Callers, API contracts, and Supabase Auth emails stay unchanged.

**Architecture:** One-row `smtp_settings` table (service-role only). Admin GET/PUT APIs never return the password. `lib/smtp-mail.ts` reads that row on each send (no env fallback, no cached transporter). Migrate each Brevo route one at a time. Add one SMTP card on `/admin/settings` without changing VAT or dropdowns.

**Tech Stack:** Next.js 13 App Router, Nodemailer (`^9.0.5`), Supabase (service role + RLS deny-all), existing `requireApiAuth(..., ['admin'])`.

**Audit source:** Email audit 2026-08-13. Plan validated 2026-08-13. Admin-dashboard SMTP locked 2026-08-13.

**Status:** VALIDATED with locked decisions D1–D6. Do not expand file scope.

---

## Locked decisions (2026-08-13)

| ID | Decision | Answer |
|----|----------|--------|
| D1 | Who can set SMTP? | Existing **`admin`** role only. No new `superadmin` role. |
| D2 | Credential source | **Dashboard only.** No `SMTP_*` env fallback. Emails fail until admin saves host, user, and password. |
| D3 | Where in the UI? | New card on existing **`/admin/settings`** (next to VAT). No new nav item. |
| D4 | Storage | Dedicated **`smtp_settings`** table + admin API. Password never returned to the browser. |
| D5 | Save behavior | After save, server runs Nodemailer `verify()`. If verify fails, **reject the save**. Blank password on update = keep current password. |
| D6 | Supabase Auth emails | **Out of scope** (invite / reset stay in Supabase Dashboard). |

---

## Validation record (2026-08-13)

| ID | Finding | Severity | Plan fix |
|----|---------|----------|----------|
| V-1 | Exactly 3 runtime Brevo call sites | Info | Route-swap phases only |
| V-2 | `authFetch` does **not** throw on HTTP 400/500 | Info | Bug callers ignore email HTTP status — keep that |
| V-3 | RFQ UI **does** parse `results[].error.message` | High | Preserve that JSON shape exactly |
| V-4 | HTML rewrite is error-prone | High | Keep existing `htmlContent` strings byte-for-byte |
| V-5 | `package.json` already has `nodemailer`; no `@getbrevo/brevo` | Info | Confirm-only unless leftover reappears |
| V-6 | Invite / password-reset are Supabase Auth | Info | Out of scope |
| V-7 | No `superadmin` role; `/admin` is `admin` only | Info | D1 |
| V-8 | VAT settings use client + RLS (rate is not a secret) | High | SMTP must **not** copy that pattern — password via API + service role only |
| V-9 | Module-level Nodemailer transporter would ignore admin saves | High | Do **not** cache transporter across requests |

---

## HARD FILE CONSTRAINTS (do not violate)

If a file is not on the allowlist, **do not open it for editing**. If typecheck fails, **stop and revert the last file** — do not “fix” unrelated files.

### Allowlist (the only files that may change)

| File | Phase | Allowed action |
|------|-------|----------------|
| `supabase/migrations/YYYYMMDDHHMMSS_smtp_settings.sql` | 1 | **Create only** — this one migration |
| `lib/smtp-mail.ts` | 2 | **Create only** |
| `app/api/admin/smtp-settings/route.ts` | 3 | **Create only** |
| `components/admin/SmtpSettingsCard.tsx` | 4 | **Create only** |
| `app/admin/settings/page.tsx` | 4 | **Additive only** — import + render card. Do not edit VAT or dropdown code |
| `app/api/bugtrack/send-email/route.ts` | 5 | Transport swap in **edit zone only** |
| `app/api/bugtrack/send-resolved-email/route.ts` | 6 | Transport swap in **edit zone only** |
| `app/api/rfq/send-email/route.ts` | 7 | Transport swap in **edit zone only** |
| `.env.staging.example` | 8 | Remove `BREVO_API_KEY` block only; add a comment that SMTP is Admin → System Settings |
| `.env.example` | 8 | Append the same comment only |
| `package.json` | 8 | Confirm only. Edit **only if** `@getbrevo/brevo` is still listed |
| `package-lock.json` | 8 | Only if `package.json` actually changed |

### Forbidden (never modify)

- `components/bugtrack/ReportBugModal.tsx`
- `app/bugtrack/page.tsx`
- `app/bugtrack/[id]/page.tsx`
- `app/rfq/[id]/page.tsx`
- `lib/canvassing.ts`
- `lib/bugtrack.ts`
- `lib/vat.ts`
- `lib/authenticated-fetch.ts`
- `lib/api-auth.ts`
- `lib/rate-limit.ts`
- `components/bugtrack/BugTrackSettingsModal.tsx`
- `config/navigation.ts` (no new menu item)
- `app/admin/page.tsx`
- Any other `app/admin/**` page
- Any other `supabase/migrations/*` except the new SMTP one
- `middleware.ts` / `middleware.js`
- `netlify.toml`
- `next.config.js` / `next.config.mjs`
- Any PR / PO / GRN / supplier / workflow page
- `docs/audit-deliverables/*` during code phases

### Frozen zones

| File | Frozen | Edit zone |
|------|--------|-----------|
| `app/admin/settings/page.tsx` | `VatSettingsCard`, `DropdownOptionsManager`, `isAdmin` gate, VAT load effect | Add import; render `<SmtpSettingsCard />` in the left column under VAT |
| `app/api/bugtrack/send-email/route.ts` | Auth, rate limit, validation, settings lookup, no-email return, outer catch, HTML | Brevo send block only |
| `app/api/bugtrack/send-resolved-email/route.ts` | Auth `['admin']`, rate limit, validation, outer catch, HTML | Brevo send block only |
| `app/api/rfq/send-email/route.ts` | Validation helper, auth `['procurement']`, `Promise.all`, `hasError`, HTML template | Brevo envelope + fetch inside the map |

### Abort rules

1. `npm run typecheck` fails → revert that phase’s file(s).
2. A forbidden file appears in `git diff` → revert it.
3. HTML template text differs from current source → revert.
4. VAT/dropdown behavior or markup changes → revert settings page.
5. GET SMTP API returns a password field → revert. Never send `password` to the client.
6. Client code reads `smtp_settings` via `lib/supabase` → revert. Table is service-role only.
7. JSON keys used by RFQ UI change (`success`, `results`, `error.message`) → revert.

---

## Surgical principles

1. **Do not touch callers** (bug report, RFQ issue, RFQ resend).
2. **Do not change** existing email route URLs, auth guards, or rate-limit keys.
3. **Do not retype HTML.** Pass the existing template as `htmlContent`.
4. **SMTP credentials live in `smtp_settings` only.** No env fallback.
5. **Do not change Supabase Auth SMTP.**
6. **One phase at a time.** Stop and verify.
7. **Preserve send JSON shapes** (bug `{ success, data }`; RFQ `{ success, results }` with `error: { message }`).
8. **No Edge runtime.** Nodemailer needs Node.
9. **Do not import `lib/smtp-mail.ts` from client components.** The settings card talks to `/api/admin/smtp-settings` only.
10. **Do not cache** a Nodemailer transporter at module scope (admin save must take effect on the next send).

---

## What users will see after implementation

### Unchanged for every role

- Login, dashboards, PR/PO/GRN/approvals, in-app bell
- BugTrack notification **recipient** setting (unchanged modal)
- Invite / forgot password / reset password (Supabase)

### By user / role

| Who | Expect after this work |
|-----|------------------------|
| **Admin (System Settings)** | New **SMTP** card under VAT. Fields: host, port, secure checkbox, username, password, from email, from name. Password box is always empty. If already saved, helper text says password is set. Save runs a connection check; failure shows an error and does **not** store the new values. |
| **Admin (BugTrack settings)** | Unchanged — still only the notification recipient. |
| **Any user reporting a bug** | Same success toast and saved bug. Mail goes out only if admin already saved working SMTP. |
| **Admin resolving a bug** | Status still updates. Reporter mail uses From: admin’s `from_email`. |
| **Procurement issuing RFQ** | RFQ still issues if mail fails (existing best-effort). |
| **Procurement resending RFQ email** | Same toasts. If SMTP is not configured or verify/send fails, error toast. |
| **Supplier / notification inboxes** | Same templates. **From:** becomes the address admin saved. May hit spam once. |
| **Non-admin users** | Cannot see or call SMTP settings APIs (403). |

### Failure behavior

| Flow | If SMTP is not saved or is down | User-visible result |
|------|----------------------------------|---------------------|
| Report bug | Send returns 400; caller ignores `res.ok` | Success toast; bug saved; no mail |
| Resolve bug | Same | Status updates; no mail |
| Issue RFQ | Errors swallowed | RFQ issues |
| Resend RFQ email | UI checks `res.ok` | Error toast |
| Admin Save SMTP | `verify()` fails | Error on the card; previous row unchanged |

---

## Phase overview

| Phase | What ships | Risk |
|-------|-----------|------|
| **0** | Decisions locked (done) | None |
| **1** | `smtp_settings` migration | None — new table, deny-all RLS |
| **2** | `lib/smtp-mail.ts` (unused by routes yet) | None |
| **3** | Admin GET/PUT API | None until UI calls it |
| **4** | SMTP card on `/admin/settings` | Low — additive UI only |
| **5** | Bug reported email → SMTP | Low |
| **6** | Bug resolved email → SMTP | Low |
| **7** | RFQ email → SMTP | Medium — batch + error shape |
| **8** | Remove Brevo env comments | None |
| **9** | Manual verification | None |

**Stop and verify after each phase.**

---

## Phase 0 — Decisions (done)

No code. D1–D6 locked above.

Admin must have client SMTP values ready to paste into System Settings **before** Phase 9 mail tests. Phases 1–4 can proceed without live SMTP (save will fail verify until credentials are real).

---

## Phase 1 — Database (`smtp_settings`)

> Ship: empty table. App behavior unchanged.

**Files:**
- Create: `supabase/migrations/20260813143000_smtp_settings.sql`
- Forbidden: every other migration and every app file

- [ ] **Step 1: Create this migration exactly**

```sql
/*
  smtp_settings — single-row SMTP config for app transactional email.
  RLS deny-all for authenticated/anon. Reads/writes go through service role only
  (admin API + sendSmtpMail). Password must never be selected by the browser client.
*/

CREATE TABLE IF NOT EXISTS public.smtp_settings (
  id           boolean PRIMARY KEY DEFAULT true,
  CONSTRAINT smtp_settings_single_row CHECK (id = true),
  host         text,
  port         integer NOT NULL DEFAULT 587,
  secure       boolean NOT NULL DEFAULT false,
  username     text,
  password     text,
  from_email   text,
  from_name    text NOT NULL DEFAULT 'Fortune Procurement',
  updated_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.smtp_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.smtp_settings FROM anon, authenticated;

-- No policies on purpose: service role bypasses RLS; browser client cannot read password.
```

- [ ] **Step 2: Apply locally** (`npx supabase db push` or the project’s usual migrate command)

- [ ] **Step 3:** Confirm VAT table and `bugtrack_settings` were not modified

---

## Phase 2 — Shared SMTP helper (additive)

> Routes still use Brevo.

**Files:**
- Create: `lib/smtp-mail.ts`
- Forbidden: everything else

- [ ] **Step 1: Create `lib/smtp-mail.ts`**

```typescript
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
```

- [ ] **Step 2:** `npm run typecheck` — PASS
- [ ] **Step 3:** `git diff --name-only` includes only `lib/smtp-mail.ts` (+ migration if uncommitted)

---

## Phase 3 — Admin SMTP API (additive)

> No UI yet. VAT page unchanged.

**Files:**
- Create: `app/api/admin/smtp-settings/route.ts`

- [ ] **Step 1: Create GET + PUT**

Use `requireApiAuth(req, ['admin'])` only (not procurement). Rate-limit keys: `admin:smtp-settings:get` and `admin:smtp-settings:put`.

```typescript
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
```

- [ ] **Step 2:** Typecheck PASS
- [ ] **Step 3:** Confirm response JSON for GET/PUT success never includes `password`

---

## Phase 4 — SMTP card on System Settings (additive UI)

**Files:**
- Create: `components/admin/SmtpSettingsCard.tsx`
- Modify: `app/admin/settings/page.tsx` — **additive only**

**Frozen on the settings page:** entire `VatSettingsCard` function, entire `DropdownOptionsManager` function, `isAdmin` check, VAT fetch.

- [ ] **Step 1: Create `SmtpSettingsCard`**

Client component. Load via `authFetch('/api/admin/smtp-settings')`. Save via `authFetch(..., { method: 'PUT', body })`. Password input `type="password"` and never filled from GET. If `password_set`, placeholder `Password saved — leave blank to keep`. Match VAT card visual language (white card, `pq-neutral` borders, `text-xs`).

Fields: Host, Port, Secure (checkbox), Username, Password, From email, From name. Submit label: `Save SMTP settings`.

Do not import `lib/smtp-mail.ts` in this client file.

- [ ] **Step 2: On `app/admin/settings/page.tsx` only add**

1. Import: `import SmtpSettingsCard from '@/components/admin/SmtpSettingsCard';`
2. In the left column (`lg:w-64` stack), **after** the VAT card, render `<SmtpSettingsCard />`.

Do not change `PageHeader` title unless adding “and email” to the description string is desired — **leave description unchanged** to avoid copy churn. Card title is enough.

- [ ] **Step 3:** Typecheck PASS
- [ ] **Step 4:** Manual: non-admin cannot open `/admin/settings` (existing redirect). Admin sees VAT + SMTP + dropdowns. Saving invalid SMTP shows error; VAT still works.

---

## Phase 5 — Migrate bug reported email

**Files:** `app/api/bugtrack/send-email/route.ts` only.

**Frozen:** rate limit key `bugtrack:send-email`; `requireApiAuth(req)`; validation; `bugtrack_settings` lookup; no-email return; outer catch; HTML string.

- [ ] Add `import { sendSmtpMail, smtpErrorMessage } from '@/lib/smtp-mail';`
- [ ] Replace Brevo send block only. Keep HTML as `htmlContent` copied from the live file.

```typescript
    const subject = `[${severity.toUpperCase()} SEVERITY] New Bug Reported: ${bugTitle}`;
    const htmlContent = `PASTE_EXISTING_htmlContent_STRING_UNCHANGED`;

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
```

- [ ] Typecheck. Diff names for this phase: this route only.
- [ ] Manual: with SMTP **not** saved, report bug still succeeds. With SMTP saved, notification inbox receives mail from `from_email`.

---

## Phase 6 — Migrate bug resolved email

**Files:** `app/api/bugtrack/send-resolved-email/route.ts` only.

**Frozen:** `requireApiAuth(req, ['admin'])`; `EMAIL_RE`; HTML; outer catch.

Same send-block pattern; `fromName: 'BugTrack System'`; subject `[RESOLVED] Bug Report: ${bugTitle}`.

- [ ] Typecheck + admin resolve still updates status if mail fails.

---

## Phase 7 — Migrate RFQ invitation email

**Files:** `app/api/rfq/send-email/route.ts` only.

**Forbidden:** `app/rfq/[id]/page.tsx`, `lib/canvassing.ts`.

**Frozen:** `isValidRfqEmailBody`, rate limit `rfq:send-email`, `requireApiAuth(req, ['procurement'])`, empty-suppliers return, `Promise.all`, `actionUrl`, **full HTML template**, `hasError` aggregation.

Inside the map, keep HTML as `htmlContent`. Replace only Brevo fetch:

```typescript
        try {
          const result = await sendSmtpMail({
            to: email,
            subject: `RFQ Issued: ${rfqNumber}`,
            html: htmlContent,
            fromName: 'Fortune Procurement',
          });
          return { email, success: true, data: result, error: null };
        } catch (error: unknown) {
          return {
            email,
            success: false,
            data: null,
            error: { message: smtpErrorMessage(error) },
          };
        }
```

RFQ page requires `error.message`. Do not return a raw Error.

Keep:

```typescript
    const hasError = results.some((r) => !r.success);
    if (hasError) {
      return NextResponse.json({ success: false, results }, { status: 400 });
    }
    return NextResponse.json({ success: true, results });
```

- [ ] Typecheck. Spot-check HTML still has “View & Submit Quotation”.
- [ ] Manual: resend success; issue RFQ still succeeds if mail fails.

---

## Phase 8 — Remove Brevo env comments

**Files:** `.env.staging.example`, `.env.example` only.

- [ ] In `.env.staging.example`, replace the Brevo block with:

```env
# App transactional email (bug + RFQ) is configured in Admin → System Settings (SMTP card).
# Invite / password-reset emails stay in Supabase Dashboard → Authentication → SMTP.
```

- [ ] In `.env.example`, append the same two comment lines after `SUPABASE_SERVICE_ROLE_KEY`. Do not add `SMTP_*` variables (D2: dashboard only).
- [ ] Search `app` + `lib` for `brevo` / `BREVO_API_KEY` — no matches.
- [ ] Do **not** remove unused `resend` package.
- [ ] After staging smoke: delete `BREVO_API_KEY` from Netlify.

---

## Phase 9 — Verification

| # | Scenario | Role | Expected |
|---|----------|------|----------|
| V1 | Open System Settings | Admin | VAT + SMTP card + dropdowns. VAT still saves. |
| V2 | GET smtp-settings | Admin | JSON has `password_set`, no `password` key |
| V3 | PUT smtp-settings as procurement | Procurement | 403 |
| V4 | Save bad password | Admin | Error; row unchanged |
| V5 | Save good SMTP | Admin | Success; password field stays empty; `password_set: true` |
| V6 | Report bug, SMTP saved | Any | Toast + mail from `from_email` |
| V7 | Report bug, SMTP not saved | Any | Toast + bug saved; no mail |
| V8 | Resolve bug | Admin | Status updates; reporter mail |
| V9 | Issue RFQ | Procurement | RFQ issues even if mail fails |
| V10 | Resend RFQ email | Procurement | Success toast + supplier mail |
| V11 | Invite / reset password | Admin / any | Unchanged (Supabase) |
| V12 | Login, PR, PO, GRN | All | Unchanged |

### Rollout

1. Apply migration to the target Supabase.
2. Deploy.
3. Admin opens System Settings and saves SMTP (verify must pass).
4. Smoke V6 + V10.
5. Remove `BREVO_API_KEY` from Netlify.

---

## Rollback

1. Revert the 3 send routes to Brevo `fetch` (mail works again if `BREVO_API_KEY` is restored).
2. Leave `smtp_settings` table + card in place (unused helper/card cannot break callers) **or** revert those commits too.
3. Partial rollback allowed (RFQ route only).

---

## Self-review

| Requirement | Covered by |
|-------------|-----------|
| Admin sets SMTP on dashboard | D1–D3, Phases 1–4 |
| Dashboard is only source | D2, `assertSmtpReady`, no `SMTP_*` env |
| Password never in browser | `publicSmtpView`, abort rule 5 |
| Verify before save | Phase 3 PUT |
| VAT/dropdowns untouched | Frozen zone on settings page |
| 3 Brevo routes | Phases 5–7 |
| Callers unchanged | Forbidden list |
| RFQ `error.message` | Phase 7 |
| No new role / nav | D1, D3 |
| Supabase Auth untouched | D6 |
