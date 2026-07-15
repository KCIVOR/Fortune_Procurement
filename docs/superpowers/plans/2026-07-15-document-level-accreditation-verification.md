# Document-Level Accreditation Verification — Implementation Plan

> **Status:** Candidate sketch for **Path B only**. Tracking / decision locks live in  
> [`2026-07-15-accreditation-documents-expiry-surgical.md`](./2026-07-15-accreditation-documents-expiry-surgical.md).  
> Do not implement from this file until Phase 0 in the surgical plan locks D1=B and related decisions.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing supplier accreditation application workflow (submit → procurement review → approve/reject), but move verification and expiry from the supplier account (`supplier_accreditations.valid_until` / status `expired` via cron) onto each submitted document (`supplier_documents.status` + `expires_at`). Documents remain informational (no RFQ blocking).

**Architecture:** Reuse the existing `supplier_documents` columns and CHECK values (`uploaded` / `accepted` / `rejected` / `expired`) — map UI labels Pending / Verified without renaming the DB enum (shared with product + RSE docs). Add procurement verify/reject/set-expiry APIs. Point nightly cron at accreditation-linked documents only. Stop writing account-level `valid_until` in approve/edit-expiry UI; leave the column in place for safe rollback and historical rows.

**Tech stack:** Next.js App Router, Supabase (Postgres + `pg_cron` + RLS already allowing procurement UPDATE on documents), existing `lib/accreditation.ts` / `lib/accreditation-documents.ts` patterns.

**Decisions locked (from product discussion):**
- Application statuses stay (option A): `approved` / `rejected` mean “review finished,” not timed account accreditation.
- Documents are informational only — do **not** change canvassing / RFQ readiness rules.
- Expiry is per document, set by procurement at verify time.
- Conceptual labels: pending → verified / rejected; verified → expired. **DB keeps** `uploaded` / `accepted` / `rejected` / `expired`.

---

## Part 1 — Audit findings (evidence only)

Audited: migration history, application TypeScript, and **live Supabase** via MCP (`list_tables` + `execute_sql`) on 2026-07-15. No assumptions beyond that evidence.

### 1.1 Live schema — `supplier_accreditations`

| Column | Live type | Notes |
|--------|-----------|--------|
| `id`, `supplier_id`, `status`, review fields, `approved_at`, `rejected_at`, timestamps | as created | |
| `valid_until` | `date` nullable | present |
| Status CHECK | `draft`, `submitted`, `under_review`, `missing_documents`, `approved`, `rejected`, `withdrawn`, `expired` | confirmed live |

`system_expiry_settings`: **does not exist** live (`to_regclass` → null).

### 1.2 Live schema — `supplier_documents`

| Column | Live type | Notes |
|--------|-----------|--------|
| `accreditation_id` / `supplier_product_id` | uuid nullable FKs | shared table |
| `expires_at` | `date` nullable | unused by app writes |
| `status` DEFAULT `'uploaded'` | CHECK: `uploaded`, `accepted`, `rejected`, `expired` | **no** `pending` / `verified` |

RLS: procurement + admin have blanket `UPDATE` on `supplier_documents`. Supplier has INSERT/SELECT only. **App never updates document status today.**

### 1.3 Live cron

Job `expire-accreditations-and-products`, schedule `0 0 * * *`, **active**:

```sql
UPDATE public.supplier_accreditations
SET status = 'expired', updated_at = now()
WHERE status = 'approved'
  AND valid_until IS NOT NULL
  AND valid_until < CURRENT_DATE;
```

Does **not** touch `supplier_documents`.

### 1.4 Live data snapshot (2026-07-15)

| Entity | Counts |
|--------|--------|
| Accreditations by status | approved 4, rejected 2, under_review 1, withdrawn 1 (**expired 0**) |
| Accreditations with `valid_until` set | **3** |
| Documents total | **19** (all `status = 'uploaded'`) |
| Documents with `expires_at` set | **0** |
| Docs by link | accreditation_id 16, product (non-RSE) 2, `rse_report` 1 |

Safe to introduce document verification: no existing non-`uploaded` document statuses to migrate.

### 1.5 Application behavior today

| Area | Reality |
|------|---------|
| Approve | Sets `approved` + optional `valid_until` (`lib/accreditation.ts` `approveAccreditation`) |
| Edit expiry / revoke / reopen | Account-level only; revoke → `expired` + clears `valid_until` |
| Document upload | Always `status: 'uploaded'`, `expires_at: null` |
| Document UI | View filename/type/date only — no status/expiry |
| Canvassing / RFQ | Uses latest accreditation **status** string; `approved` = ready. Docs not consulted |
| Procurement supplier list | Maps unknown statuses (incl. `expired`) → `'none'` |
| Product `valid_until` | Separate module; cron already stopped for products — **out of scope** |

### 1.6 Vocabulary mapping (do not rename DB)

| User language | DB value (keep) | UI label |
|---------------|-----------------|----------|
| pending | `uploaded` | Pending |
| verified | `accepted` | Verified |
| rejected | `rejected` | Rejected |
| expired | `expired` | Expired |

**Why not rename CHECK to pending/verified:** `supplier_documents` is shared with product docs and RSE reports. Renaming forces a data migration and widens blast radius for zero functional gain.

### 1.7 Risk inventory (surgical constraints)

| Risk | Mitigation in this plan |
|------|-------------------------|
| Breaking product/RSE docs | Only verify/expire rows with `accreditation_id IS NOT NULL` and `supplier_product_id IS NULL` (accreditation application docs). Cron same filter. |
| Breaking RFQ assign | Do not change `lib/canvassing.ts` readiness or AssignSuppliersModal rules |
| Breaking approve/reject workflow | Keep all application status transitions; only remove account expiry **inputs** |
| Historical `valid_until` on 3 rows | Leave column; stop writing; optional one-time null (Task 1) — do **not** DROP column in v1 |
| Existing `expired` accreditation status | Keep CHECK value + reopen path; stop cron from creating new ones; revoke may remain as manual emergency close |
| No automated test suite | Verify via SQL + manual UI checklist (repo has no `*.test.ts` for accreditation) |

### 1.8 Out of scope (v1)

- Approaching-expiry notifications / emails
- Auto-OCR expiry from PDF
- RFQ / canvassing blocking on document expiry
- Enforced required document types on submit
- Product verification expiry changes
- Dropping `supplier_accreditations.valid_until` or removing `expired` from accreditation CHECK
- Renaming document status enum

---

## Part 2 — File map

| File | Change |
|------|--------|
| `supabase/migrations/20260715120000_document_expiry_cron.sql` | Create — replace cron; index for doc expiry; optional null account `valid_until` |
| `lib/accreditation-documents.ts` | Modify — verify / reject / update expiry helpers |
| `lib/accreditation.ts` | Modify — `approveAccreditation` always `valid_until: null`; deprecate account expiry writers from UI path |
| `types/database.ts` | Touch only if comments/types need clarifying (status unions already correct) |
| `app/accreditation/[id]/page.tsx` | Modify — per-doc actions; remove approve/edit account expiry panels |
| `app/accreditation/page.tsx` | Modify — remove Valid Until column / Expired-by-account tab reliance on `valid_until` |
| `app/supplier/accreditation/page.tsx` | Modify — show doc status + expiry (read-only) |

**Do not touch (unless a compile error forces a type import):**  
`lib/canvassing.ts`, `components/canvassing/AssignSuppliersModal.tsx`, `app/rfq/[id]/page.tsx`, `lib/supplier-products.ts`, product accreditation pages, RSE upload paths (except they keep inserting `uploaded` — unchanged).

---

## Part 3 — Implementation tasks

### Task 1: Migration — document cron + stop account auto-expiry

**Files:**
- Create: `supabase/migrations/20260715120000_document_expiry_cron.sql`

- [ ] **Step 1: Add migration file**

```sql
/*
  # Document-level expiry for accreditation documents

  - Stop nightly auto-expiry of supplier_accreditations via valid_until
  - Expire accepted accreditation documents past expires_at
  - Scope: accreditation application docs only
    (accreditation_id IS NOT NULL AND supplier_product_id IS NULL)
  - Leave supplier_accreditations.valid_until column in place (no DROP)
  - Clear lingering account valid_until so UI/cron cannot resurrect account expiry
*/

CREATE INDEX IF NOT EXISTS idx_supplier_documents_accreditation_expiry_check
  ON public.supplier_documents (expires_at)
  WHERE status = 'accepted'
    AND expires_at IS NOT NULL
    AND accreditation_id IS NOT NULL
    AND supplier_product_id IS NULL;

SELECT cron.unschedule('expire-accreditations-and-products');

SELECT cron.schedule(
  'expire-accreditations-and-products',
  '0 0 * * *',
  $$
    UPDATE public.supplier_documents
    SET status = 'expired', updated_at = now()
    WHERE status = 'accepted'
      AND expires_at IS NOT NULL
      AND expires_at < CURRENT_DATE
      AND accreditation_id IS NOT NULL
      AND supplier_product_id IS NULL;
  $$
);

UPDATE public.supplier_accreditations
SET valid_until = NULL, updated_at = now()
WHERE valid_until IS NOT NULL;
```

- [ ] **Step 2: Apply migration**

Use project workflow (Supabase CLI or MCP `apply_migration` with name `document_expiry_cron` and the SQL above).

- [ ] **Step 3: Verify live**

```sql
SELECT jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'expire-accreditations-and-products';

SELECT count(*) AS still_have_valid_until
FROM supplier_accreditations
WHERE valid_until IS NOT NULL;
-- expect 0

SELECT indexname FROM pg_indexes
WHERE tablename = 'supplier_documents'
  AND indexname = 'idx_supplier_documents_accreditation_expiry_check';
```

Expected: cron `command` updates `supplier_documents` (not `supplier_accreditations`); `still_have_valid_until = 0`; index exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260715120000_document_expiry_cron.sql
git commit -m "$(cat <<'EOF'
db: expire accreditation documents nightly instead of accounts

EOF
)"
```

---

### Task 2: Document verify / reject / edit-expiry library

**Files:**
- Modify: `lib/accreditation-documents.ts`

- [ ] **Step 1: Add helpers after `getDocumentsByAccreditationId`**

Add these functions (keep existing upload helpers unchanged — still insert `uploaded` + `expires_at: null`):

```ts
function assertAccreditationDocRow(row: {
  id: string;
  accreditation_id: string | null;
  supplier_product_id: string | null;
  status: string;
}): void {
  if (!row.accreditation_id || row.supplier_product_id) {
    throw new Error('Only accreditation application documents can be verified here.');
  }
}

function assertFutureDateOrThrow(expiresAt: string): void {
  const chosen = new Date(`${expiresAt}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(chosen.getTime()) || chosen <= today) {
    throw new Error('Expiry date must be a valid date in the future.');
  }
}

/** uploaded → accepted + expires_at (required). */
export async function verifyAccreditationDocument(
  documentId: string,
  expiresAt: string,
  profile: UserProfile
): Promise<void> {
  if (!expiresAt?.trim()) throw new Error('Expiry date is required to verify a document.');
  assertFutureDateOrThrow(expiresAt.trim());

  const db = supabase as any;
  const { data: row, error: fetchErr } = await db
    .from('supplier_documents')
    .select('id, accreditation_id, supplier_product_id, status')
    .eq('id', documentId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Document not found.');
  assertAccreditationDocRow(row);
  if ((row as any).status !== 'uploaded' && (row as any).status !== 'accepted') {
    throw new Error('Only pending or verified documents can be verified / re-verified.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_documents')
    .update({
      status: 'accepted',
      expires_at: expiresAt.trim(),
      updated_at: now,
    })
    .eq('id', documentId)
    .in('status', ['uploaded', 'accepted']);
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'ACCREDITATION_DOCUMENT_VERIFIED',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id: documentId,
      payload: {
        reviewer: profile.full_name,
        expires_at: expiresAt.trim(),
        accreditation_id: (row as any).accreditation_id,
      },
    });
  } catch { /* best-effort */ }
}

/** uploaded | accepted → rejected; clears expires_at. */
export async function rejectAccreditationDocument(
  documentId: string,
  profile: UserProfile,
  reason?: string
): Promise<void> {
  const db = supabase as any;
  const { data: row, error: fetchErr } = await db
    .from('supplier_documents')
    .select('id, accreditation_id, supplier_product_id, status')
    .eq('id', documentId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Document not found.');
  assertAccreditationDocRow(row);
  if (!['uploaded', 'accepted'].includes((row as any).status)) {
    throw new Error('Only pending or verified documents can be rejected.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_documents')
    .update({
      status: 'rejected',
      expires_at: null,
      updated_at: now,
    })
    .eq('id', documentId)
    .in('status', ['uploaded', 'accepted']);
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'ACCREDITATION_DOCUMENT_REJECTED',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id: documentId,
      payload: {
        reviewer: profile.full_name,
        reason: reason?.trim() || null,
        accreditation_id: (row as any).accreditation_id,
      },
    });
  } catch { /* best-effort */ }
}

/** Edit expires_at on accepted docs only. */
export async function updateAccreditationDocumentExpiry(
  documentId: string,
  expiresAt: string,
  profile: UserProfile
): Promise<void> {
  if (!expiresAt?.trim()) throw new Error('Expiry date is required.');
  assertFutureDateOrThrow(expiresAt.trim());

  const db = supabase as any;
  const { data: row, error: fetchErr } = await db
    .from('supplier_documents')
    .select('id, accreditation_id, supplier_product_id, status, expires_at')
    .eq('id', documentId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Document not found.');
  assertAccreditationDocRow(row);
  if ((row as any).status !== 'accepted') {
    throw new Error('Only verified documents can have expiry edited.');
  }

  const now = new Date().toISOString();
  const oldExpires = (row as any).expires_at ?? null;
  const { error } = await db
    .from('supplier_documents')
    .update({ expires_at: expiresAt.trim(), updated_at: now })
    .eq('id', documentId)
    .eq('status', 'accepted');
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'ACCREDITATION_DOCUMENT_EXPIRY_UPDATED',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id: documentId,
      payload: {
        updated_by: profile.full_name,
        old_expires_at: oldExpires,
        new_expires_at: expiresAt.trim(),
        accreditation_id: (row as any).accreditation_id,
      },
    });
  } catch { /* best-effort */ }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add lib/accreditation-documents.ts
git commit -m "$(cat <<'EOF'
feat: add verify/reject/expiry helpers for accreditation documents

EOF
)"
```

---

### Task 3: Stop writing account `valid_until` on approve

**Files:**
- Modify: `lib/accreditation.ts` — `approveAccreditation` (approx lines 385–460)

- [ ] **Step 1: Change approve to never set account expiry**

Replace the `validUntil` validation block and update payload so approve always writes `valid_until: null`. Keep the 4th parameter temporarily for call-site compatibility, but ignore it:

```ts
export async function approveAccreditation(
  accreditationId: string,
  profile:         UserProfile,
  reviewNotes?:    string,
  /** @deprecated Account expiry removed — documents carry expires_at. Ignored. */
  _validUntil?:    string | null
): Promise<void> {
  // ... existing fetch + withdrawn guard unchanged ...

  const now = new Date().toISOString();

  const { error } = await db
    .from('supplier_accreditations')
    .update({
      status:       'approved',
      approved_at:  now,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: reviewNotes ?? null,
      valid_until:  null,
      updated_at:   now,
    })
    .eq('id', accreditationId);
  if (error) throw error;

  // audit payload: remove valid_until or set null
  // notification unchanged
}
```

- [ ] **Step 2: Leave `updateAccreditationExpiry` / `revokeAccreditation` in the file**

Do **not** delete them in this task (avoids breaking imports mid-PR). UI will stop calling `updateAccreditationExpiry` in Task 4. Revoke remains available as emergency “mark application expired” (not time-based cron).

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/accreditation.ts
git commit -m "$(cat <<'EOF'
fix: stop setting account valid_until on accreditation approve

EOF
)"
```

---

### Task 4: Procurement detail UI — verify documents; remove account expiry panels

**Files:**
- Modify: `app/accreditation/[id]/page.tsx`

- [ ] **Step 1: Imports**

Add:

```ts
import {
  getDocumentsByAccreditationId,
  verifyAccreditationDocument,
  rejectAccreditationDocument,
  updateAccreditationDocumentExpiry,
} from '@/lib/accreditation-documents';
```

Remove unused imports after Step 2: `updateAccreditationExpiry` (and `CalendarClock` if unused). Keep `revokeAccreditation` / `reopenAccreditationForReview`.

- [ ] **Step 2: Remove account-expiry UX only**

Remove or gut:
- `ActionPanel` value `'edit_expiry'`
- `expiryInput` / `expiryError` used for **application** approve/edit (document rows will use local state)
- Approve panel date input + validation that calls `approveAccreditation(..., expiryInput)`
- Call sites for `updateAccreditationExpiry` / `handleEditExpiry`
- Banners that show “valid until {accreditation.valid_until}” and days-left for **approved account**
- “Edit Expiry” button in post-approval actions

Keep: Under review, Request docs, Approve (notes only), Reject, Revoke, Reopen.

Approve call becomes:

```ts
await approveAccreditation(accreditation.id, profile, noteInput.trim() || undefined);
```

- [ ] **Step 3: Replace `DocumentRow` with actionable row**

Replace the read-only `DocumentRow` (bottom of file) with a component that:

1. Shows status chip labels: `uploaded`→Pending, `accepted`→Verified, `rejected`→Rejected, `expired`→Expired
2. Shows `expires_at` when present
3. When application is reviewable (`submitted` | `under_review` | `missing_documents`) **or** `approved` (allow fixing docs post-approve without reopening — optional; **minimum:** allow verify while `canApprove || status === 'approved'`):
   - Pending (`uploaded`): date input + “Verify” + “Reject”
   - Verified (`accepted`): show expiry + “Edit expiry” + “Reject”
   - Rejected / Expired: read-only (supplier must re-upload a new file for a new pending row)

Wire handlers that call the Task 2 helpers, then `loadDocs(accreditation.id)`.

Pass `profile`, `busy`/`setBusy`, and `disabled` when `status` is `withdrawn` | `rejected` (no edits).

- [ ] **Step 4: Copy / labels**

- Change chip label for application `approved` from “Accredited” to “Approved” (optional but clearer: review finished).
- Update header blurb to mention document verification + per-document expiry.
- Leave linked products section untouched.

- [ ] **Step 5: Manual UI check**

1. Open an under_review application with docs.
2. Verify one doc with future date → status Verified, expiry shown.
3. Reject another → Rejected, no expiry.
4. Approve application with notes only → `approved`, `valid_until` stays null.
5. Confirm Edit Expiry / approve-date UI is gone.
6. Confirm View still opens signed URL.

- [ ] **Step 6: Commit**

```bash
git add app/accreditation/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat: procurement verifies accreditation documents with per-doc expiry

EOF
)"
```

---

### Task 5: Queue page — stop relying on account `valid_until`

**Files:**
- Modify: `app/accreditation/page.tsx`

- [ ] **Step 1: Remove Valid Until column rendering** that uses `row.valid_until` (approx lines 286–304 and column header).

- [ ] **Step 2: Adjust “Expired” tab**

Today the Expired tab filters `status === 'expired'` on **applications**. Keep that filter for any historical/manual revoke rows, but remove UI that implies account `valid_until` drives the tab. Do **not** add a documents-expired tab in v1 (YAGNI).

- [ ] **Step 3: Smoke-check queue loads; commit**

```bash
git add app/accreditation/page.tsx
git commit -m "$(cat <<'EOF'
refactor: remove account valid_until from accreditation queue UI

EOF
)"
```

---

### Task 6: Supplier portal — show document status / expiry (read-only)

**Files:**
- Modify: `app/supplier/accreditation/page.tsx`

- [ ] **Step 1: On each listed document**, show:
  - Status label (Pending / Verified / Rejected / Expired)
  - Expiry date when `expires_at` is set

Do not allow suppliers to set expiry or change status (RLS already blocks UPDATE).

- [ ] **Step 2: Manual check as supplier — upload still works; verified docs show expiry.**

- [ ] **Step 3: Commit**

```bash
git add app/supplier/accreditation/page.tsx
git commit -m "$(cat <<'EOF'
feat: show accreditation document status and expiry to suppliers

EOF
)"
```

---

### Task 7: Final verification checklist

- [ ] **Step 1: SQL sanity**

```sql
-- Cron targets documents
SELECT command FROM cron.job WHERE jobname = 'expire-accreditations-and-products';

-- No account valid_until
SELECT count(*) FROM supplier_accreditations WHERE valid_until IS NOT NULL;

-- Document status distribution after manual verify in UI
SELECT status, count(*) FROM supplier_documents
WHERE accreditation_id IS NOT NULL AND supplier_product_id IS NULL
GROUP BY status;

-- Product/RSE docs untouched pattern (still uploaded unless separately changed)
SELECT status, document_type, count(*) FROM supplier_documents
WHERE supplier_product_id IS NOT NULL OR document_type = 'rse_report'
GROUP BY status, document_type;
```

- [ ] **Step 2: Regression walkthrough**

| Case | Expected |
|------|----------|
| Supplier create draft → upload → submit | Unchanged |
| Procurement under review / missing docs / reject | Unchanged |
| Procurement approve | `approved`, `valid_until` null, no account expiry UI |
| Verify doc | `accepted` + `expires_at` |
| Reject doc | `rejected`, `expires_at` null |
| RFQ assign modal | Still uses application `approved` only (informational docs) |
| Product verification pages | Unchanged |
| Revoke (if used) | Still sets application `expired` manually; cron does not |
| Simulate doc expiry | Set `expires_at` to yesterday on an `accepted` acc doc; run the UPDATE from cron body once; status → `expired` |

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Final commit only if docs/progress notes updated** (optional — skip unless asked)

---

## Part 4 — Rollback notes

1. Re-schedule cron from `20260714180000_stop_product_expiry_cron.sql` (account UPDATE).
2. Revert app commits for Tasks 2–6.
3. `valid_until` column still present — re-enable approve UI if needed.
4. Document rows left as `accepted`/`rejected`/`expired` remain valid under existing CHECK — no schema rollback required for status values.

---

## Part 5 — Spec coverage / self-review

| Requirement | Task |
|-------------|------|
| Keep accreditation submit/review flow | Tasks 3–4 (approve/reject kept) |
| Procurement verifies each document + sets expiry | Tasks 2, 4 |
| No account-level expiry | Tasks 1, 3, 5 |
| Documents informational (no RFQ gate) | Explicit do-not-touch list |
| pending/verified vocabulary | UI labels; DB `uploaded`/`accepted` |
| Surgical / shared table safe | Cron + helpers filter accreditation-only docs |
| No approaching notifications / OCR | Out of scope |

**Placeholder scan:** none intentional.  
**Type consistency:** helpers use `accepted`/`uploaded` matching live CHECK.

---
