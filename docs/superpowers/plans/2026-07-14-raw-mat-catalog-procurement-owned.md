# Procurement-owned raw-mat catalog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move catalog ownership to procurement (create as `verified` for raw mat suppliers only); raw mat suppliers get read-only catalog access; non–raw-mat and service suppliers lose catalog access and quote manually; remove product RSE/TSQA verification path; backfill suppliers who already have products to `raw_material`; temporarily keep raw-mat ability to quote services RFQs via manual entry.

**Architecture:** Extend session profile with `supplier_supply_type` for gates. Add service-role API for procurement to INSERT verified `supplier_products` for a chosen supplier. Tighten RLS (deny supplier INSERT; allow procurement insert/update). Strip supplier create/submit/propose-product UI. Gate nav + routes for catalog by supply type. Strip Create RSE / pending_tsqa actions from product review UI. One data migration for supply-type backfill.

**Tech stack:** Next.js App Router, Supabase RLS + service-role APIs, existing `lib/supplier-products.ts` / `lib/procurement-suppliers.ts` patterns.

**Spec:** `docs/superpowers/specs/2026-07-14-raw-mat-catalog-procurement-owned-design.md`

**Branch base:** Continue on `feat/supplier-supply-type` or cut `feat/raw-mat-catalog-procurement-owned` from it.

---

## Part 0 — Audit findings (do not re-assume)

### A. Can raw-mat suppliers quote services “for now”?

**Yes — already possible in code today.**

| Evidence | Location |
|----------|----------|
| Manual mode always available for goods & services RFQs | `app/supplier/quotations/[rfqSupplierId]/page.tsx` (`isServiceRfq` changes labels only) |
| No hard block of services RFQ by `supplier_supply_type` | Field unused in canvassing/quotation |
| Soft type-mismatch confirm only | `confirmPickerProduct` — Proceed anyway |
| Live: 3 verified `item_type=services` products; ≥1 quote linked to a services product | MCP on project `emddvbocupvufzvhcacz` |

**Plan rule:** Do **not** add a supply-type × `request_type` block in Phase work below. Track as **Future** if client later wants raw-mat = goods RFQs only.

### B. Catalog / RLS / TSQA (must change)

| Finding | Implication |
|---------|-------------|
| Procurement UPDATE yes, INSERT no | Need new INSERT path (API + RLS or service role) |
| Supplier owns create/submit | Remove UI + deny INSERT |
| `supplier_supply_type` not on `UserProfile` | Must load for gates |
| Direct verify already exists (`markProductVerified`) | Upload-as-verified can skip RSE entirely |
| 8/10 suppliers have products; all labeled `normal` today | Backfill those 8 → `raw_material` |

### C. Live product inventory (MCP)

- 37 verified goods, 3 verified services, 5 expired goods, 1 draft goods, 1 rejected goods  
- Suppliers with products: Cruz Janitorial (6, 1 service), Prime Tech (6, 2 services), six others with 5 goods each; 2 suppliers with 0 products  

---

## File map (expected)

| File | Change |
|------|--------|
| `supabase/migrations/20260714XXXX_catalog_ownership_and_backfill.sql` | Backfill supply type; RLS insert/deny |
| `types/auth.ts`, `lib/profile.ts` | Session `supplier_supply_type` |
| `app/api/procurement/products/create/route.ts` | NEW — create verified product for supplier |
| `lib/supplier-products.ts` | Procurement create helper; deprecate supplier create/RFQ propose |
| `config/navigation.ts` / Sidebar or role nav filter | Hide catalog unless raw mat |
| `config/route-access.ts` or page guards | Block `/supplier/products` for non–raw-mat |
| `app/supplier/products/**` | Read-only; remove new/edit/submit |
| `app/supplier/quotations/[rfqSupplierId]/page.tsx` | Remove propose-new; hide catalog pick if not raw mat |
| `app/accreditation/products/**` | Procurement create UI; remove Create RSE / TSQA tabs |
| `lib/rse.ts` / product detail | Stop product→RSE create from UI |

---

### Task 1: Data migration — backfill + RLS foundation

**Files:**
- Create: `supabase/migrations/20260714160000_catalog_ownership_rls_and_backfill.sql`

- [ ] **Step 1: Write migration SQL**

```sql
/*
  Catalog ownership shift + supply-type backfill
  - Suppliers who already have any supplier_products → raw_material
  - Deny supplier INSERT on supplier_products
  - Allow procurement/admin INSERT of verified rows for any supplier_id
*/

-- 1) Backfill: has products → raw mat supplier
UPDATE public.profiles AS p
SET supplier_supply_type = 'raw_material'
FROM public.roles AS r
WHERE p.role_id = r.id
  AND r.name = 'supplier'
  AND EXISTS (
    SELECT 1 FROM public.supplier_products sp WHERE sp.supplier_id = p.id
  );

-- 2) Drop supplier INSERT (replace with deny-by-absence or explicit false policy)
DROP POLICY IF EXISTS "supplier_products_supplier_insert" ON public.supplier_products;

-- Optional explicit deny for clarity (Postgres: no policy = deny for role under RLS)
-- Re-create SELECT unchanged; UPDATE policy stays for withdraw of DRAFT historical rows
-- or tighten supplier UPDATE to no-op / SELECT-only later in Task 3.

-- 3) Procurement/admin INSERT verified products on behalf of a supplier
DROP POLICY IF EXISTS "supplier_products_procurement_insert" ON public.supplier_products;
CREATE POLICY "supplier_products_procurement_insert"
  ON public.supplier_products FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name IN ('procurement', 'admin')
    )
    AND status = 'verified'
  );

-- Admin already has UPDATE; procurement UPDATE already exists from base schema.
```

**Note:** Prefer service-role API for insert (mirror VAT/supply-type) even if RLS allows JWT insert — plan Task 2 uses service role so `reviewed_by` / notifications are consistent and bypasses trigger edge cases. Still add RLS for defense-in-depth if any client insert is used.

- [ ] **Step 2: Apply via MCP `apply_migration`** on `emddvbocupvufzvhcacz`; verify:

```sql
SELECT supplier_supply_type, count(*)
FROM profiles p JOIN roles r ON r.id = p.role_id
WHERE r.name = 'supplier'
GROUP BY 1;

-- Expect: raw_material for suppliers with products; normal for the 2 with zero products (kertutilmi, Rovick) unless data changed.
```

- [ ] **Step 3: Commit migration file**

```bash
git add supabase/migrations/20260714160000_catalog_ownership_rls_and_backfill.sql
git commit -m "feat: backfill raw-mat supply type and procurement product insert RLS"
```

---

### Task 2: Session profile exposes `supplier_supply_type`

**Files:**
- Modify: `types/auth.ts`
- Modify: `lib/profile.ts` (`fetchUserProfile` select)

- [ ] **Step 1: Add to `UserProfile`**

```typescript
supplier_supply_type: 'raw_material' | 'normal' | 'service' | null;
```

- [ ] **Step 2: Select + map in `fetchUserProfile`**

Add `supplier_supply_type` to the profiles select list; normalize invalid → `null`.

- [ ] **Step 3: `npx tsc --noEmit`**; fix call sites that construct `UserProfile` manually if any.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: load supplier_supply_type on session profile"
```

---

### Task 3: Procurement API — create verified product for supplier

**Files:**
- Create: `app/api/procurement/products/create/route.ts`
- Modify: `lib/supplier-products.ts` (shared types/helpers only if needed)

- [ ] **Step 1: Implement `POST`** (auth: procurement|admin; service role write)

Body:

```typescript
{
  supplier_id: string;       // must be role supplier + supply_type raw_material
  product_name: string;
  product_code?: string | null;
  category?: string | null;
  description?: string | null;
  specifications?: string | null;
  item_type?: 'goods' | 'services'; // default 'goods'; temp allow services
  valid_until?: string | null;     // optional expiry date
}
```

Behavior:

1. JWT auth → role procurement/admin.
2. Service role: load target profile; require `roles.name === 'supplier'` and `supplier_supply_type === 'raw_material'` else 400.
3. INSERT `supplier_products` with:
   - `status: 'verified'`
   - `verified_at`, `reviewed_at`, `reviewed_by` = actor
   - `submitted_at` = now (optional, for audit trail)
   - `item_type` default `'goods'`
4. Audit log e.g. `SUPPLIER_PRODUCT_CREATED_BY_PROCUREMENT`.
5. Best-effort notify supplier.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: procurement API to create verified supplier catalog products"
```

---

### Task 4: Procurement UI — upload product (no RSE/TSQA)

**Files:**
- Create: `app/accreditation/products/new/page.tsx` (or modal from queue)
- Modify: `app/accreditation/products/page.tsx` — “Add product” CTA; remove/hide “Under TSQA” as primary path
- Modify: `app/accreditation/products/[id]/page.tsx` — remove **Create RSE for TSQA** button and related flow; keep view of historical `pending_tsqa` rows read-only

- [ ] **Step 1:** Form: pick supplier (filter `supplier_supply_type === 'raw_material'` via `listSupplierAccounts` + field), product fields, Save → `POST /api/procurement/products/create`.

- [ ] **Step 2:** On product detail, delete/disable:
  - `createRSEFromSupplierProduct` button
  - Copy that says “create an RSE”
  - Do **not** delete `app/tsqa/**` in this task (historical RSEs may exist)

- [ ] **Step 3: Manual test** as procurement: create product for Ace Supply (after Task 1 backfill if they have products); confirm status verified in DB.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: procurement UI to add verified catalog products; hide product RSE"
```

---

### Task 5: Supplier catalog — raw mat only, read-only

**Files:**
- Modify: `components/layout/Sidebar.tsx` and/or `config/navigation.ts` role nav builder
- Modify: `app/supplier/products/page.tsx`
- Modify: `app/supplier/products/[id]/page.tsx`
- Delete or redirect: `app/supplier/products/new/page.tsx`
- Modify: `components/dashboards/SupplierDashboard.tsx` (KPI visibility)

- [ ] **Step 1: Nav gate**

Show Product Catalog only if:

```typescript
profile.role === 'supplier' && profile.supplier_supply_type === 'raw_material'
```

- [ ] **Step 2: Page gate**

On `/supplier/products` and `/supplier/products/[id]` and `/supplier/products/new`:

- If not raw mat → redirect to `/dashboard` (or Forbidden EmptyState). **Do not** rely on nav hide alone.

- [ ] **Step 3: Read-only UI for raw mat**

Remove: Add to Catalog, Edit draft, Submit, Withdraw, Re-verify, document upload that creates new product context (decide: keep viewing existing docs).  
List remains `getMySupplierProducts`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: restrict product catalog to raw-mat suppliers read-only"
```

---

### Task 6: Quotation UI — remove propose-new; catalog pick only for raw mat

**Files:**
- Modify: `app/supplier/quotations/[rfqSupplierId]/page.tsx`
- Modify: `lib/supplier-products.ts` — stop exporting or hard-fail `createAndSubmitSupplierProductForRFQ` / `createSupplierProduct` from client paths

- [ ] **Step 1:** Remove `propose_new` mode and `createAndSubmitSupplierProductForRFQ` calls.

- [ ] **Step 2:** If `supplier_supply_type !== 'raw_material'`:
  - Hide `select_verified` / catalog picker
  - Keep **manual_entry** and **no_quote** (required for non–raw-mat / service suppliers and for temporary services quoting)

- [ ] **Step 3:** If raw mat:
  - Keep catalog pick for verified+active products
  - Keep **manual_entry** so they can still quote **services RFQs** temporarily (per audit — do not gate manual by `isServiceRfq`)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: quote UI without supplier product create; catalog pick raw-mat only"
```

---

### Task 7: Deny supplier product writes in app + tighten RLS triggers

**Files:**
- Modify: `lib/supplier-products.ts` — `createSupplierProduct`, `updateSupplierProduct`, `submit…`, `createAndSubmit…` throw `Error('Suppliers cannot modify the product catalog.')` when called from supplier context (or delete exports and fix compile errors)
- Migration follow-up if needed: drop/replace `enforce_supplier_products_supplier_update` to block supplier updates entirely (withdraw optional: prefer no supplier writes)

- [ ] **Step 1:** Make supplier mutation functions throw; remove UI callers (Tasks 5–6).

- [ ] **Step 2:** Migration:

```sql
DROP POLICY IF EXISTS "supplier_products_supplier_update" ON public.supplier_products;
-- suppliers retain SELECT of own rows only
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: remove supplier write access to supplier_products"
```

---

### Task 8: Verification checklist (manual)

- [ ] Backfill: suppliers with products are `raw_material`; zero-product suppliers stay `normal` (or whatever they were).
- [ ] As **non raw mat** supplier: no Product Catalog in sidebar; `/supplier/products` blocked; quotation has manual only.
- [ ] As **raw mat** supplier: catalog visible read-only; no Add; can pick catalog on goods RFQ; can **manual-quote a services RFQ**.
- [ ] As **procurement**: create product for raw-mat supplier → DB `verified`; appears in supplier read-only list; appears in quote picker; no Create RSE on new flow.
- [ ] As **procurement**: create for `normal`/`service` supplier rejected by API.
- [ ] `npx tsc --noEmit` passes.

---

## Future (not in this plan)

1. Revoke temporary rule: block raw-mat suppliers from services RFQs / force goods-only invites.
2. Delete or archive historical `pending_tsqa` / RSE rows UI in `/tsqa`.
3. Whether procurement may still create `item_type=services` catalog rows for raw-mat suppliers (temp API allows; product can restrict to `goods` only later).
4. List badge for supply type on `/suppliers`.

---

## Self-review vs requirements

| Requirement | Task(s) |
|-------------|---------|
| Supplier cannot upload catalog | 5, 6, 7 |
| Procurement uploads for raw mat, verified | 3, 4 |
| Non–raw-mat / service: no sidebar + URL | 2, 5 |
| Raw mat: catalog read-only | 5 |
| No TSQA next step on upload | 3, 4 |
| Has products → raw mat | 1 |
| Manual quote for non–catalog suppliers | 6 |
| Temp: raw mat can quote services | 6 (explicit keep) + Part 0 |

No placeholders for code owners — paths named above. Enum storage values unchanged (`raw_material` \| `normal` \| `service`).
