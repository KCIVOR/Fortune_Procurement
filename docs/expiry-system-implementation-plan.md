# Expiry System — Implementation Plan
**Scope:** Supplier Accreditation + Product/Service Verification  
**Mode:** Surgical — minimum file changes, zero breakage of existing approval/review logic  
**Date:** 2026-06-24

---

## Audit Summary (Pre-Implementation State)

### Database
| Table | Relevant Fields | Missing |
|-------|----------------|---------|
| `supplier_accreditations` | `approved_at`, `rejected_at`, `status` (no 'expired') | `valid_until`, 'expired' status value |
| `supplier_products` | `verified_at`, `rejected_at`, `status` (no 'expired') | `valid_until`, 'expired' status value |
| `supplier_documents` | `expires_at`, `status` includes 'expired' | ✅ already has expiry (existing pattern) |
| `system_expiry_settings` | — | **entire table does not exist** |

### pg_cron
- Available on this Supabase project (`pg_cron v1.6.4`) but **not enabled**.
- Must be enabled manually in Supabase Dashboard → Database → Extensions **before** running Phase 2 migration.

### Code Entry Points (approval/verification)
| Function | File | Line | What it writes on success |
|----------|------|------|--------------------------|
| `approveAccreditation()` | `lib/accreditation.ts` | ~364 | `status='approved'`, `approved_at`, `reviewed_by`, `reviewed_at` |
| `markProductVerified()` | `lib/supplier-products.ts` | ~315 | `status='verified'`, `verified_at`, `reviewed_by`, `reviewed_at` |
| `revokeAccreditation()` | `lib/accreditation.ts` | ~491 | currently `status='rejected'` ← **will change to 'expired'** |
| `revokeProductVerification()` | `lib/supplier-products.ts` | ~440 | currently `status='inactive'` ← **will change to 'expired'** |

### Design Decision (confirmed by user)
- Manual revocation and cron-auto-expiry both set `status = 'expired'`.
- `'rejected'` remains only for rejection **during the review process** (before approval/verification).
- `'inactive'` is retired from use for products (replaced by `'expired'` for manual revocation post-verification).

---

## Status After Full Implementation

```
supplier_accreditations.status:
  draft | submitted | under_review | missing_documents | approved | rejected | withdrawn | expired (NEW)

supplier_products.status:
  draft | submitted | under_review | pending_tsqa | verified | rejected | inactive | withdrawn | expired (NEW)
  (inactive kept in constraint for backwards compat with any existing rows)
```

---

## Phase 1 — Database Schema

**Files to create:**
- `supabase/migrations/YYYYMMDDHHMMSS_expiry_system_schema.sql`

**What it does (surgical — additive only, no dropping/altering existing columns):**

### 1a. Create `system_expiry_settings` table

```sql
CREATE TABLE public.system_expiry_settings (
  id                          boolean PRIMARY KEY DEFAULT TRUE,
  CONSTRAINT single_row       CHECK (id = TRUE),
  accreditation_validity_days integer NOT NULL DEFAULT 365,
  product_validity_days       integer NOT NULL DEFAULT 365,
  updated_by                  uuid    REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Seed default row immediately
INSERT INTO public.system_expiry_settings DEFAULT VALUES;
```

The `CHECK (id = TRUE)` + boolean PK is the standard single-row settings pattern — no sequence needed, no accidentally inserting a second row.

### 1b. Add `valid_until` to both tables

```sql
ALTER TABLE public.supplier_accreditations
  ADD COLUMN IF NOT EXISTS valid_until date;

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS valid_until date;
```

Nullable. NULL = no expiry set (pre-existing approved/verified records, or records approved before this feature was deployed).

### 1c. Extend status check constraints to include 'expired'

```sql
-- Accreditations
ALTER TABLE public.supplier_accreditations
  DROP CONSTRAINT IF EXISTS supplier_accreditations_status_check;
ALTER TABLE public.supplier_accreditations
  ADD CONSTRAINT supplier_accreditations_status_check
  CHECK (status IN (
    'draft', 'submitted', 'under_review', 'missing_documents',
    'approved', 'rejected', 'withdrawn', 'expired'
  ));

-- Products
ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_status_check;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_status_check
  CHECK (status IN (
    'draft', 'submitted', 'under_review', 'pending_tsqa',
    'verified', 'rejected', 'inactive', 'withdrawn', 'expired'
  ));
```

`'inactive'` stays in the product constraint for backwards compatibility with any existing rows.

### 1d. Index for cron job performance

```sql
CREATE INDEX IF NOT EXISTS idx_accreditations_expiry_check
  ON public.supplier_accreditations (status, valid_until)
  WHERE status = 'approved' AND valid_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_expiry_check
  ON public.supplier_products (status, valid_until)
  WHERE status = 'verified' AND valid_until IS NOT NULL;
```

---

## Phase 2 — RLS Policies

**Files to create:**
- `supabase/migrations/YYYYMMDDHHMMSS_expiry_system_rls.sql`

### 2a. `system_expiry_settings` RLS

```sql
ALTER TABLE public.system_expiry_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (needed to compute valid_until on approve)
CREATE POLICY "authenticated_read_expiry_settings"
  ON public.system_expiry_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only superadmin/admin can update
CREATE POLICY "admin_update_expiry_settings"
  ON public.system_expiry_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
  );
```

### 2b. Verify existing RLS on supplier_accreditations / supplier_products handles 'expired'

Check: any existing policy that allows SELECT/UPDATE `WHERE status = 'approved'` or `WHERE status = 'verified'` needs to also include `'expired'` where appropriate (specifically for supplier's own reads).

**Surgical check:**
- Supplier reads their own accreditation: typically `WHERE supplier_id = auth.uid()` — no status filter, so already works.
- Procurement reads all: no status filter, already works.
- The cron job runs as `postgres` / service role, bypasses RLS — no change needed.

If any policy has explicit status equality checks, add 'expired' to those.

---

## Phase 3 — pg_cron Nightly Job

**Pre-requisite (manual):** Enable pg_cron in Supabase Dashboard → Database → Extensions.

**Files to create:**
- `supabase/migrations/YYYYMMDDHHMMSS_expiry_cron_job.sql`

```sql
-- Requires pg_cron to be enabled first
SELECT cron.schedule(
  'expire-accreditations-and-products',   -- job name (unique)
  '0 0 * * *',                            -- midnight UTC daily
  $$
    UPDATE public.supplier_accreditations
    SET
      status     = 'expired',
      updated_at = now()
    WHERE
      status     = 'approved'
      AND valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE;

    UPDATE public.supplier_products
    SET
      status     = 'expired',
      updated_at = now()
    WHERE
      status     = 'verified'
      AND valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE;
  $$
);
```

**Notes:**
- `valid_until IS NOT NULL` guard means pre-existing approved/verified records with no expiry date are never touched by the cron.
- `valid_until < CURRENT_DATE` (not `<=`) means expiry happens the day after the `valid_until` date. If you want it to expire ON that date, use `<= CURRENT_DATE`.
- The cron runs as `postgres` (superuser), so no RLS concerns.
- To remove or reschedule: `SELECT cron.unschedule('expire-accreditations-and-products');`

---

## Phase 4 — TypeScript Types

**Files to modify:**
- `types/database.ts`

### 4a. Add `valid_until` to existing table Row/Insert/Update types

**`supplier_accreditations`:**
```typescript
Row: {
  // ... existing fields ...
  valid_until: string | null;   // ADD — date string 'YYYY-MM-DD'
}
Insert: {
  // ... existing fields ...
  valid_until?: string | null;  // ADD
}
Update: {
  // ... existing fields ...
  valid_until?: string | null;  // ADD
}
```

Also add `'expired'` to the `status` union in Row/Insert/Update for `supplier_accreditations`.

**`supplier_products`:**
Same pattern — add `valid_until` to Row/Insert/Update, add `'expired'` to status union.

### 4b. Add new `system_expiry_settings` table

```typescript
system_expiry_settings: {
  Row: {
    id: boolean;
    accreditation_validity_days: number;
    product_validity_days: number;
    updated_by: string | null;
    updated_at: string;
  };
  Insert: {
    id?: boolean;
    accreditation_validity_days?: number;
    product_validity_days?: number;
    updated_by?: string | null;
    updated_at?: string;
  };
  Update: {
    accreditation_validity_days?: number;
    product_validity_days?: number;
    updated_by?: string | null;
    updated_at?: string;
  };
};
```

Also add convenience export at the bottom:
```typescript
export type SystemExpirySettings = Database['public']['Tables']['system_expiry_settings']['Row'];
```

---

## Phase 5 — Business Logic (lib files)

### 5a. New file: `lib/system-settings.ts`

**Functions:**
- `getExpirySettings(): Promise<SystemExpirySettings>` — single SELECT, throws if no row
- `updateExpirySettings(profile, settings): Promise<void>` — UPDATE + audit log

No complex logic. Straightforward Supabase client calls.

### 5b. Surgical update: `lib/accreditation.ts`

**`approveAccreditation()` — ~line 364:**

ADD after `approved_at` is computed:
```typescript
const settings = await getExpirySettings();
const validUntil = new Date(now);
validUntil.setDate(validUntil.getDate() + settings.accreditation_validity_days);
const validUntilStr = validUntil.toISOString().split('T')[0]; // 'YYYY-MM-DD'
```

ADD to the UPDATE payload:
```typescript
valid_until: validUntilStr,
```

**`revokeAccreditation()` — ~line 491:**

Change `status: 'rejected'` → `status: 'expired'`  
ADD to UPDATE payload: `valid_until: null`  
Change audit log action from `'ACCREDITATION_REVOKED'` → `'ACCREDITATION_EXPIRED'` (or keep as-is — your call)

**`reopenAccreditationForReview()` — ~line 555:**

Already clears `approved_at = null`. ADD: `valid_until: null` to the UPDATE payload.

**Nothing else changes.** All other functions (markUnderReview, requestMissingDocuments) are untouched.

### 5c. Surgical update: `lib/supplier-products.ts`

**`markProductVerified()` — ~line 315:**

ADD after `verified_at` is computed:
```typescript
const settings = await getExpirySettings();
const validUntil = new Date(now);
validUntil.setDate(validUntil.getDate() + settings.product_validity_days);
const validUntilStr = validUntil.toISOString().split('T')[0];
```

ADD to UPDATE payload: `valid_until: validUntilStr`

**`revokeProductVerification()` — ~line 440:**

Change `status: 'inactive'` → `status: 'expired'`  
ADD to UPDATE payload: `valid_until: null`  
Change audit log action from `'SUPPLIER_PRODUCT_VERIFICATION_REVOKED'` → `'SUPPLIER_PRODUCT_EXPIRED'` (or keep)

**`reopenProductForReview()` — ~line 507:**

Already clears `verified_at = null`. ADD: `valid_until: null` to the UPDATE payload.

**Nothing else changes.**

---

## Phase 6 — Admin Settings UI

**Files to create:**
- `app/admin/settings/page.tsx`

**What it shows:**
- Page title: "System Settings"
- Section: "Accreditation & Verification Expiry"
  - "Accreditations are valid for: [__] days" (number input, min 1, max 3650)
  - "Product/Service verifications are valid for: [__] days" (number input)
  - Helper text: "e.g. 365 = 1 year, 730 = 2 years. Changes apply only to new approvals."
  - Save button → calls `updateExpirySettings()`
  - Last updated by / date shown below

**Access guard:** Show page only if `profile?.role === 'admin' || profile?.role === 'superadmin'`. Others see 403/redirect.

**Files to modify (navigation):**
- Wherever admin sidebar nav is defined — add "Settings" link pointing to `/admin/settings`.

---

## Phase 7 — Accreditation Queue UI

**Files to modify:**
- `app/accreditation/page.tsx`
- `app/accreditation/[id]/page.tsx`

### 7a. `app/accreditation/page.tsx`

**Add 'expired' to `FilterKey` type:**
```typescript
type FilterKey = 'pending' | 'approved' | 'rejected' | 'expired' | 'all';
```

**Add 'expired' to `getFilteredRows()`:**
```typescript
case 'expired':
  return rows.filter(r => r.status === 'expired');
```

**Add 'expired' to tab counts and tab config.**

**Add `valid_until` column to table:**
- New column header: "Valid Until"
- Cell: show date if `valid_until` exists; show "—" if not set; if `valid_until < today`, show red "Expired" badge instead.

**Add `accreditationChip()` entry for 'expired':**
```typescript
expired: { variant: 'cancelled', label: 'Expired' },
```

**`AccreditationQueueRow` type** (in `lib/accreditation.ts`) — add `valid_until: string | null`.

### 7b. `app/accreditation/[id]/page.tsx`

**Add expiry info block near the `approved_at` display (~line 314):**

```tsx
{accreditation.approved_at && accreditation.valid_until && (
  <div>
    <dt>Valid Until</dt>
    <dd>
      {format(new Date(accreditation.valid_until), 'MMM d, yyyy')}
      {new Date(accreditation.valid_until) < new Date() && (
        <span className="ml-2 text-xs text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded-full px-2 py-0.5">
          Expired
        </span>
      )}
    </dd>
  </div>
)}
```

**Add 'expired' to `accreditationChip()` map.**

**Handle 'expired' in action buttons:** When `status === 'expired'`, show a "Re-open for Review" button (same as when `status === 'approved'`, which already exists as `handleReopen()`). No new action needed — reusing existing reopen flow.

---

## Phase 8 — Product/Service Verification UI

**Files to modify:**
- `app/accreditation/products/page.tsx`
- `app/accreditation/products/[id]/page.tsx`
- `app/supplier/products/page.tsx`

### 8a. `app/accreditation/products/page.tsx`

Same surgical changes as Phase 7a but for products:
- Add 'expired' to `FilterKey` type and `getFilteredRows()`
- Add Expired tab with count
- Add `valid_until` column to table
- Add 'expired' to `productChip()` map: `expired: { variant: 'cancelled', label: 'Expired' }`

### 8b. `app/accreditation/products/[id]/page.tsx`

Same surgical changes as Phase 7b but for products:
- Show `valid_until` next to `verified_at` display (~line 425)
- Expired badge if `valid_until < today`
- 'expired' status handled in `productChip()` and action buttons

**Handle 'expired' in action buttons:** When `status === 'expired'`, show "Re-open for Review" — same `reopenProductForReview()` function already exists.

### 8c. `app/supplier/products/page.tsx`

**Surgical-only change:**
- In `ProductRow`, update `canOffer` logic:
  ```typescript
  // Before:
  const canOffer = product.status === 'verified';
  // After:
  const canOffer = product.status === 'verified' && (
    !product.valid_until || new Date(product.valid_until) >= new Date()
  );
  ```
- If expired: show "Expired" badge (red) instead of "Can Offer" or "Not Verified".
- Add `valid_until` display in the `dateNote` block:
  ```typescript
  : product.valid_until
  ? <span className="text-pq-neutral-400">Expires {format(new Date(product.valid_until), 'MMM d, yyyy')}</span>
  : null;
  ```
- Add 'expired' to `productChip()` map.

---

## Surgical Rules (What NOT to Change)

| Area | Rule |
|------|------|
| Approval/review forms | No change to form fields or step UI — only the `lib` function payload changes |
| Existing audit log actions | Keep existing action strings; add new `_EXPIRED` variant only for revoke-turned-expire |
| `'rejected'` status | Not touched — remains for rejection during review process only |
| `'inactive'` status | Kept in DB constraint for backwards compat; not used going forward for revocation |
| RFQ / PO / PR2 flows | No change — expiry only surfaces in accreditation and product pages |
| `supplier_documents` expiry | Already has its own `expires_at` — completely separate, do not touch |
| Existing migrations | Never modify — only add new migration files |

---

## Migration File Naming

```
supabase/migrations/20260624100000_expiry_system_schema.sql   -- Phase 1
supabase/migrations/20260624100100_expiry_system_rls.sql       -- Phase 2
supabase/migrations/20260624100200_expiry_cron_job.sql         -- Phase 3 (after pg_cron enabled)
```

---

## File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `supabase/migrations/20260624100000_expiry_system_schema.sql` | CREATE | 1 |
| `supabase/migrations/20260624100100_expiry_system_rls.sql` | CREATE | 2 |
| `supabase/migrations/20260624100200_expiry_cron_job.sql` | CREATE | 3 |
| `types/database.ts` | MODIFY — add columns + new table type | 4 |
| `lib/system-settings.ts` | CREATE | 5a |
| `lib/accreditation.ts` | MODIFY — 3 surgical edits (approve, revoke, reopen) | 5b |
| `lib/supplier-products.ts` | MODIFY — 3 surgical edits (verify, revoke, reopen) | 5c |
| `app/admin/settings/page.tsx` | CREATE | 6 |
| Admin nav component | MODIFY — add Settings link | 6 |
| `app/accreditation/page.tsx` | MODIFY — add Expired tab + valid_until column | 7a |
| `app/accreditation/[id]/page.tsx` | MODIFY — show valid_until + expired badge | 7b |
| `app/accreditation/products/page.tsx` | MODIFY — add Expired tab + valid_until column | 8a |
| `app/accreditation/products/[id]/page.tsx` | MODIFY — show valid_until + expired badge | 8b |
| `app/supplier/products/page.tsx` | MODIFY — canOffer logic + expiry display | 8c |

**Total: 5 new files, 9 modified files, 3 migration files.**

---

## Rollback Strategy

- Phases 1–3 are DB-only and additive. Rolling back = running `ALTER TABLE ... DROP COLUMN valid_until` + `DROP TABLE system_expiry_settings` + `SELECT cron.unschedule(...)`.
- Phases 4–8 are app-layer. Rolling back = reverting the specific TypeScript edits; the DB doesn't care.
- The cron job only touches rows where `valid_until IS NOT NULL`, so existing approved/verified records without a `valid_until` are 100% safe even if the cron runs before the app is updated.
