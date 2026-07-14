# Supplier Supply Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let procurement/admin set an exclusive supplier supply type (`raw_material` | `normal` | `service`) on `/suppliers/[id]`, stored on `profiles`, with no change to catalog/RFQ enforcement in v1.

**Architecture:** Add nullable `profiles.supplier_supply_type` via migration. Read it through existing `lib/procurement-suppliers.ts`. Write it via a new admin/procurement PATCH API (same pattern as VAT status: JWT authz + service-role update + audit log). UI is a new card form on `SupplierAccountDetail`, cloned from the VAT control pattern.

**Tech stack:** Next.js App Router, Supabase SQL migrations + service role API, existing UI (`Card`, `Button`).

**Spec:** `docs/superpowers/specs/2026-07-14-supplier-supply-type-design.md`

**Definitions:**
- `raw_material` — inputs (glue, cardboard, …)
- `normal` — regular goods (ballpen, paper, …), not raw mats
- `service` — services (calibration, …)

---

## File map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260714120000_profiles_supplier_supply_type.sql` | Schema: column + CHECK + comment |
| `lib/procurement-suppliers.ts` | Type + select + map field onto `SupplierAccount` |
| `app/api/admin/users/[id]/supply-type/route.ts` | PATCH: set type for supplier profiles |
| `components/admin/SupplierSupplyTypeForm.tsx` | Exclusive 3-option control + Save |
| `components/procurement/SupplierAccountDetail.tsx` | Render form card + callback prop |
| `app/suppliers/[id]/page.tsx` | Local state update after save |
| `types/database.ts` | Add column on `profiles` Row/Insert/Update (if present) |

**Do not touch:** `supplier_products`, canvassing/RFQ award guards, PR1 `is_raw_material`, VAT or payment-terms routes (copy pattern only).

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260714120000_profiles_supplier_supply_type.sql`

- [ ] **Step 1: Add migration file**

```sql
/*
  # profiles.supplier_supply_type

  Exclusive classification set by procurement/admin on Supplier Accounts.
  Nullable until set. Does not constrain products or RFQ in v1.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supplier_supply_type text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_supplier_supply_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_supplier_supply_type_check
  CHECK (
    supplier_supply_type IS NULL
    OR supplier_supply_type IN ('raw_material', 'normal', 'service')
  );

COMMENT ON COLUMN public.profiles.supplier_supply_type IS
  'Exclusive supplier classification: raw_material | normal | service. Set by procurement/admin. NULL = unset.';
```

- [ ] **Step 2: Apply migration**

Prefer project migration workflow (CLI or Supabase MCP `apply_migration` with name `profiles_supplier_supply_type` and the SQL above). Target project: `emddvbocupvufzvhcacz`.

Verify with SQL:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'supplier_supply_type';
```

Expected: one row, `text`, `YES` nullable.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260714120000_profiles_supplier_supply_type.sql
git commit -m "$(cat <<'EOF'
feat: add profiles.supplier_supply_type for exclusive supplier classification

EOF
)"
```

---

### Task 2: Types + read model

**Files:**
- Modify: `lib/procurement-suppliers.ts`
- Modify: `types/database.ts` (profiles Row/Insert/Update — add field if the table block exists; if `is_vat_registered` is also missing from generated types, add both for consistency or only `supplier_supply_type`)

- [ ] **Step 1: Extend `SupplierAccount` and select**

In `lib/procurement-suppliers.ts`:

```typescript
export type SupplierSupplyType = 'raw_material' | 'normal' | 'service';

export interface SupplierAccount {
  id: string;
  full_name: string;
  email: string;
  active: boolean;
  payment_terms: string | null;
  /** Rev #1 (VAT): whether this supplier is VAT-registered; toggled by procurement/admin. */
  is_vat_registered: boolean;
  /** Exclusive supply classification; null until procurement sets it. */
  supplier_supply_type: SupplierSupplyType | null;
  created_at: string;
  accreditation_status: SupplierAccreditationStatus;
  accreditation_id: string | null;
  product_count: number;
}
```

Update:

```typescript
const PROFILE_SELECT =
  'id, full_name, email, payment_terms, is_vat_registered, supplier_supply_type, created_at, active, role_id, roles(name)';
```

Extend `ProfileRow`:

```typescript
supplier_supply_type?: string | null;
```

In `enrichProfiles` mapping, add:

```typescript
supplier_supply_type: (() => {
  const v = p.supplier_supply_type;
  if (v === 'raw_material' || v === 'normal' || v === 'service') return v;
  return null;
})(),
```

- [ ] **Step 2: Smoke-check TypeScript**

Run: `npx tsc --noEmit`  
Expected: no new errors from these fields (fix any accidental typos first).

- [ ] **Step 3: Commit**

```bash
git add lib/procurement-suppliers.ts types/database.ts
git commit -m "$(cat <<'EOF'
feat: surface supplier_supply_type on SupplierAccount read model

EOF
)"
```

---

### Task 3: PATCH API

**Files:**
- Create: `app/api/admin/users/[id]/supply-type/route.ts`

- [ ] **Step 1: Create route** (mirror `app/api/admin/users/[id]/vat-status/route.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED = new Set(['raw_material', 'normal', 'service'] as const);
type SupplyType = 'raw_material' | 'normal' | 'service';

type Body = {
  supplier_supply_type?: SupplyType | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const targetUserId = params.id;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: actorProfile } = await supabaseUser
      .from('profiles')
      .select('role_id, roles(name)')
      .eq('id', user.id)
      .maybeSingle();

    const actorRole = (actorProfile as { roles?: { name?: string } } | null)?.roles?.name;
    if (actorRole !== 'admin' && actorRole !== 'procurement') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin or procurement role required.' },
        { status: 403 },
      );
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

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const nextValue = body.supplier_supply_type;
    if (nextValue !== null && nextValue !== undefined && !ALLOWED.has(nextValue as SupplyType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'supplier_supply_type must be raw_material, normal, service, or null',
        },
        { status: 400 },
      );
    }
    if (nextValue === undefined) {
      return NextResponse.json(
        { success: false, error: 'supplier_supply_type is required (use null to clear)' },
        { status: 400 },
      );
    }

    const { data: targetUser, error: targetErr } = await admin
      .from('profiles')
      .select('id, full_name, email, role_id, roles(name), supplier_supply_type')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetErr || !targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const targetRole = (targetUser as { roles?: { name?: string } }).roles?.name;
    if (targetRole !== 'supplier') {
      return NextResponse.json(
        { success: false, error: 'Supply type can only be set for supplier users.' },
        { status: 400 },
      );
    }

    const currentValue =
      (targetUser as { supplier_supply_type?: string | null }).supplier_supply_type ?? null;

    if (currentValue === nextValue) {
      return NextResponse.json({ success: true, supplier_supply_type: nextValue });
    }

    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({ supplier_supply_type: nextValue })
      .eq('id', targetUserId)
      .select('supplier_supply_type')
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { success: false, error: updateErr?.message ?? 'Failed to update supply type' },
        { status: 400 },
      );
    }

    const row = targetUser as { id: string; full_name: string; email: string };

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'SUPPLIER_SUPPLY_TYPE_UPDATED',
      document_type: 'PROFILE',
      document_id: targetUserId,
      payload: {
        target_user_id: targetUserId,
        target_user_email: row.email,
        target_user_name: row.full_name,
        old_supplier_supply_type: currentValue,
        new_supplier_supply_type: nextValue,
      },
    });

    return NextResponse.json({
      success: true,
      supplier_supply_type:
        (updated as { supplier_supply_type?: string | null }).supplier_supply_type ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
```

**v1 note:** Allow `null` to clear. UI can omit a Clear button in Task 4 if product prefers “must pick once”; API still supports null for admin recovery.

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/users/[id]/supply-type/route.ts
git commit -m "$(cat <<'EOF'
feat: add procurement/admin API to set supplier_supply_type

EOF
)"
```

---

### Task 4: Supply type form UI

**Files:**
- Create: `components/admin/SupplierSupplyTypeForm.tsx`

- [ ] **Step 1: Create form** (mirror `components/admin/SupplierVatStatusForm.tsx` layout)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import type { SupplierSupplyType } from '@/lib/procurement-suppliers';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle2 } from 'lucide-react';

const OPTIONS: { value: SupplierSupplyType; label: string; hint: string }[] = [
  {
    value: 'raw_material',
    label: 'Raw material',
    hint: 'Inputs such as glue, cardboard, etc.',
  },
  {
    value: 'normal',
    label: 'Normal',
    hint: 'Regular goods such as ballpen, paper — not raw materials.',
  },
  {
    value: 'service',
    label: 'Service',
    hint: 'Services such as calibration.',
  },
];

interface SupplierSupplyTypeFormProps {
  userId: string;
  initialSupplyType: SupplierSupplyType | null;
  onSuccess?: (supplyType: SupplierSupplyType | null) => void;
}

export default function SupplierSupplyTypeForm({
  userId,
  initialSupplyType,
  onSuccess,
}: SupplierSupplyTypeFormProps) {
  const { session } = useAuth();
  const [supplyType, setSupplyType] = useState<SupplierSupplyType | null>(initialSupplyType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSupplyType(initialSupplyType);
  }, [initialSupplyType]);

  const hasChanges = supplyType !== initialSupplyType;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (supplyType === null) {
      setError('Select a supply type before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/users/${userId}/supply-type`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ supplier_supply_type: supplyType }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error ?? 'Failed to update supply type');
        return;
      }

      setSuccess(true);
      onSuccess?.(data.supplier_supply_type ?? null);
      setTimeout(() => setSuccess(false), 2500);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
          Supply type
        </span>
        <p className="text-xs text-pq-neutral-500">
          Exclusive classification for this supplier account. Does not automatically change
          product catalog or RFQ rules.
        </p>
        <div className="grid gap-2 pt-1 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const selected = supplyType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={saving}
                onClick={() => setSupplyType(opt.value)}
                className={`rounded border px-3 py-2 text-left transition-colors ${
                  selected
                    ? 'border-pq-primary-600 bg-pq-primary-50 text-pq-primary-700'
                    : 'border-pq-neutral-200 text-pq-neutral-700 hover:bg-pq-neutral-50'
                }`}
              >
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-pq-neutral-500">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-xs text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Supply type updated.</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!hasChanges || saving || supplyType === null}
          className="bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm"
        >
          {saving ? 'Saving...' : 'Save Supply Type'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/SupplierSupplyTypeForm.tsx
git commit -m "$(cat <<'EOF'
feat: add SupplierSupplyTypeForm exclusive selector UI

EOF
)"
```

---

### Task 5: Wire into supplier account detail

**Files:**
- Modify: `components/procurement/SupplierAccountDetail.tsx`
- Modify: `app/suppliers/[id]/page.tsx`

- [ ] **Step 1: Detail component**

Import `SupplierSupplyTypeForm` and extend props:

```typescript
onSupplyTypeUpdated?: (supplyType: import('@/lib/procurement-suppliers').SupplierSupplyType | null) => void;
```

Add card **after** VAT Registration card (or immediately before it — prefer **after Payment Terms / before VAT**, or **after VAT**; pick **after VAT** to keep VAT undisturbed):

```tsx
<Card className="bg-white rounded-lg border border-pq-neutral-200 p-6">
  <h3 className="text-sm font-semibold text-pq-neutral-900 mb-1">Supplier Supply Type</h3>
  <p className="text-xs text-pq-neutral-500 mb-4">
    Marks whether this account is a raw material, normal goods, or service supplier.
  </p>
  <SupplierSupplyTypeForm
    userId={supplier.id}
    initialSupplyType={supplier.supplier_supply_type}
    onSuccess={onSupplyTypeUpdated}
  />
</Card>
```

Pass `onSupplyTypeUpdated` through the component props list like `onVatStatusUpdated`.

- [ ] **Step 2: Page state**

In `app/suppliers/[id]/page.tsx`:

```tsx
onSupplyTypeUpdated={(supplyType) =>
  setSupplier((prev) => (prev ? { ...prev, supplier_supply_type: supplyType } : prev))
}
```

- [ ] **Step 3: Manual verify**

1. As procurement, open `/suppliers/<known-supplier-id>`.
2. Confirm card shows; unset suppliers have no option pre-selected.
3. Select **Normal** → Save → success; reload → still Normal.
4. Change to **Service** → Save → persists.
5. As non-procurement (if available), confirm route still denied; API returns 403 without procurement/admin token.
6. Confirm product catalog / RFQ flows unchanged (smoke open one product page and one RFQ).

- [ ] **Step 4: Commit**

```bash
git add components/procurement/SupplierAccountDetail.tsx app/suppliers/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat: show supplier supply type control on account detail

EOF
)"
```

---

### Task 6 (optional): List column badge

Skip unless product asks. Keep v1 shippable without this.

**Files:**
- Modify: `components/procurement/SupplierAccountsTable.tsx`

- [ ] Add a “Supply type” column: show label or `—` when null. No filter in this optional task.

---

## Verification checklist (end)

- [ ] Migration applied on `emddvbocupvufzvhcacz`
- [ ] `getSupplierAccountById` returns `supplier_supply_type`
- [ ] PATCH updates only supplier role targets; rejects invalid enum
- [ ] Audit log row `SUPPLIER_SUPPLY_TYPE_UPDATED` written
- [ ] UI exclusive selection works; save disabled when unchanged / null selection on first visit until pick
- [ ] No edits to canvassing / product `item_type` enforcement

---

## Self-review

| Spec item | Task |
|-----------|------|
| Exclusive enum | Tasks 1, 3, 4 |
| Nullable until set | Tasks 1, 4 (UI requires pick before first save) |
| Procurement/admin only | Task 3 |
| `/suppliers/[id]` UI | Task 5 |
| Label-only v1 | Explicit non-goals; no Task edits those files |
| Audit trail | Task 3 |

No placeholders left in task code blocks. Field name is consistently `supplier_supply_type` / `SupplierSupplyType`.
