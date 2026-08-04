# PR2-Native Substitute Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make supplier alternative quotes on PR2-native RFQs (`pr1_id` null, `pr2_id` set) visible and decidable in Substitute Review for the requestor and procurement, without changing behavior of the existing PR1 substitute path.

**Architecture:** Additive dual-parent model. Extend `substitute_decisions` with nullable `pr2_id` and an exactly-one-parent CHECK so existing PR1 rows stay valid. Keep all current PR1 fetch/save/UI/notification branches intact; add parallel PR2 branches gated on `rfq.pr1_id === null && rfq.pr2_id`. Award-blocking on the RFQ matrix already keys off `substitute_decisions` by quote id — once PR2 decisions can be stored and listed, Can Award unlocks with no matrix rewrite.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), existing `lib/canvassing.ts` substitute helpers, `/substitutes` UI.

**Audit evidence (do not re-litigate):**
- Live RFQ `9453a6c7-83c9-49ff-907f-543053d9b8db` (RFQ-2026-0012): `pr1_id=null`, `pr2_id` → PR2-2026-0012
- Alt quote `fb9d1e27-8072-4a65-b6c0-6717964243b6`: `is_alternative=true`, `pr1_item_id=null`, `pr2_item_id` set, zero `substitute_decisions` rows, zero substitute notifications
- Root cause: `fetchSubstituteReviewBundles` / detail / notify / schema are PR1-only; RFQ page still blocks award on pending alts → dead end

---

## Safety constraints (non-negotiable)

These constrain every task. If a change violates one, stop and revise.

1. **PR1 path byte-stable intent.** Do not refactor, rename, or “clean up” the PR1 substitute fetch/save/RLS/UI for goods/services RFQs that have `pr1_id`. Add PR2 branches beside them.
2. **Exactly one parent.** Every `substitute_decisions` row must have exactly one of `pr1_id` / `pr2_id` non-null. Enforce in DB CHECK + app validation.
3. **No silent parent guessing.** When saving a decision, resolve parent from the quote → `rfq_batches` (`pr1_id` / `pr2_id`). Never write a PR2 decision into `pr1_id` or vice versa.
4. **Existing RLS policies stay.** Do not DROP/rewrite PR1 requestor or procurement policies. Add new PR2 requestor policies; Postgres ORs permissive policies.
5. **Notifications: extend gate only.** Keep the existing `if (rfq.pr1_id && alternativeCount > 0)` block unchanged. Add a sibling `else if (rfq.pr2_id && alternativeCount > 0)` block.
6. **Award matrix unchanged for PR1.** `selectWinningQuote` already loads decisions by `rfq_item_quote_id`. Do not change that guard’s PR1 semantics.
7. **Scope = all PR2-native RFQs**, not only `request_type = raw_material` (Planning-direct services share the same `pr1_id` null shape).
8. **No historical backfill required.** There are no PR2 substitute decisions today; migration is schema + policy only.
9. **Route access:** Planning Staff use `employee` + module visibility today; keep `/substitutes` roles `employee | procurement`. Do not invent a new role gate unless live auth proves Planning cannot open `/substitutes`.
10. **Out of scope this plan:** fixing Dust Mask quoted as non-alternative (`is_alternative=false`) on a mismatched steel line; supplier inbox Purpose/Department blank fields.

---

## File map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260803120000_substitute_decisions_pr2_native.sql` | Nullable `pr1_id`, add `pr2_id`, CHECK, index, PR2 requestor RLS |
| `types/canvassing.ts` | Additive types: `pr2_id`, `source`, nullable `pr1_id` / `pr1_item_id` |
| `lib/canvassing.ts` | Parallel PR2 branches in list/detail/save/notify; keep PR1 branches |
| `app/substitutes/page.tsx` | Link PR2 bundles to detail; show PR1/PR2 number label |
| `app/substitutes/[pr1Id]/page.tsx` | Resolve PR1 **or** PR2 by id; pass correct parent into save |
| `docs/revision-progress.md` (optional short note) | Record that Phase-3 “PR1-only substitute” limitation is lifted |

No new tables. No new nav module. No changes to `app/rfq/[id]/page.tsx` award UI (already correct once decisions exist).

---

### Task 1: Schema + RLS migration (additive)

**Files:**
- Create: `supabase/migrations/20260803120000_substitute_decisions_pr2_native.sql`

- [ ] **Step 1: Write the migration**

```sql
/*
  PR2-native substitute decisions

  - Allow substitute_decisions rows keyed to pr2_requests (Planning-direct / raw-mat RFQs)
  - Keep all existing PR1 rows valid (pr1_id set, pr2_id null)
  - Exactly one parent enforced by CHECK
  - Add PR2 requestor SELECT/INSERT/UPDATE policies; leave PR1 + procurement policies untouched
*/

-- 1) Parent columns
ALTER TABLE public.substitute_decisions
  ALTER COLUMN pr1_id DROP NOT NULL;

ALTER TABLE public.substitute_decisions
  ADD COLUMN IF NOT EXISTS pr2_id uuid REFERENCES public.pr2_requests(id) ON DELETE CASCADE;

-- 2) Exactly one parent (PR1 XOR PR2)
ALTER TABLE public.substitute_decisions
  DROP CONSTRAINT IF EXISTS substitute_decisions_exactly_one_parent;

ALTER TABLE public.substitute_decisions
  ADD CONSTRAINT substitute_decisions_exactly_one_parent
  CHECK (
    (pr1_id IS NOT NULL AND pr2_id IS NULL)
    OR (pr1_id IS NULL AND pr2_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS substitute_decisions_pr2_id_idx
  ON public.substitute_decisions(pr2_id);

-- 3) PR2 requestor SELECT (additive — OR with existing policies)
DROP POLICY IF EXISTS "Requestor can view own pr2 substitute decisions" ON public.substitute_decisions;
CREATE POLICY "Requestor can view own pr2 substitute decisions"
  ON public.substitute_decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pr2_requests pr
      WHERE pr.id = substitute_decisions.pr2_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

-- 4) PR2 requestor INSERT
DROP POLICY IF EXISTS "Requestor can insert pr2 substitute decisions" ON public.substitute_decisions;
CREATE POLICY "Requestor can insert pr2 substitute decisions"
  ON public.substitute_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    decided_by = auth.uid()
    AND pr2_id IS NOT NULL
    AND pr1_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.pr2_requests pr
      WHERE pr.id = substitute_decisions.pr2_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

-- 5) PR2 requestor UPDATE (mirror PR1 override-friendly USING; attribution via WITH CHECK)
DROP POLICY IF EXISTS "Requestor can update own pr2 substitute decisions" ON public.substitute_decisions;
CREATE POLICY "Requestor can update own pr2 substitute decisions"
  ON public.substitute_decisions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pr2_requests pr
      WHERE pr.id = substitute_decisions.pr2_id
        AND pr.requisitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    decided_by = auth.uid()
    AND pr2_id IS NOT NULL
    AND pr1_id IS NULL
  );
```

**Do not** alter these existing policies in this migration:
- `"Requestor can view own substitute decisions"`
- `"Procurement can view all substitute decisions"`
- `"Requestor can insert substitute decisions"`
- `"Requestor can update own substitute decisions"`
- `"Procurement can insert substitute decisions"`
- `"Procurement can update substitute decisions"`

- [ ] **Step 2: Apply migration to staging**

Run against project `emddvbocupvufzvhcacz` (same as app `.env.local` / MCP):

```bash
npx supabase db push
```

Or paste SQL in Supabase SQL editor if CLI is not linked.

- [ ] **Step 3: Verify constraint + existing PR1 rows**

```sql
-- Existing PR1 decisions still satisfy CHECK
SELECT count(*) AS pr1_rows_ok
FROM substitute_decisions
WHERE pr1_id IS NOT NULL AND pr2_id IS NULL;

-- CHECK rejects dual-null / dual-set (expect error)
-- INSERT INTO substitute_decisions (rfq_item_quote_id, pr1_id, pr2_id, decision, decided_by)
-- VALUES ('00000000-0000-0000-0000-000000000001', null, null, 'accepted', auth.uid());
```

Expected: `pr1_rows_ok` = current row count; no data loss.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260803120000_substitute_decisions_pr2_native.sql
git commit -m "$(cat <<'EOF'
feat(db): allow substitute_decisions to key off PR2-native RFQs

Add nullable pr2_id with exactly-one-parent CHECK and PR2 requestor RLS
without rewriting existing PR1 policies.
EOF
)"
```

---

### Task 2: Types (additive only)

**Files:**
- Modify: `types/canvassing.ts`

- [ ] **Step 1: Extend decision + review types**

Update `SubstituteDecisionRow`:

```ts
export interface SubstituteDecisionRow {
  id:                string;
  rfq_item_quote_id: string;
  /** Set for PR1-originated RFQs; null for PR2-native. */
  pr1_id:            string | null;
  /** Set for PR2-native RFQs; null for PR1-originated. */
  pr2_id?:           string | null;
  decision:          SubstituteDecision;
  decided_by:        string;
  decided_at:        string;
  notes:             string | null;
  created_at:        string;
}
```

Update `SubstituteReviewItem` — allow either item key:

```ts
export interface SubstituteReviewItem {
  // ...existing fields...
  /** PR1 line id when source is PR1; null for PR2-native. */
  pr1_item_id:           string | null;
  /** PR2 line id when source is PR2-native; null for PR1. */
  pr2_item_id?:          string | null;
  // ...rest unchanged...
}
```

Update `SubstituteReviewBundle`:

```ts
export interface SubstituteReviewBundle {
  /** Which parent document this bundle belongs to. */
  source: 'pr1' | 'pr2';
  /**
   * Display header. For source='pr1' this is the real PR1.
   * For source='pr2', fields are mapped: id=pr2.id, pr1_number=pr2.pr2_number.
   * Keeping this shape avoids rewriting every index/detail consumer.
   */
  pr1: {
    id:                          string;
    pr1_number:                  string;
    purpose:                     string;
    department_name_snapshot:    string;
    requisitioner_id:            string;
    requisitioner_name_snapshot: string;
    priority?:                   string;
  };
  substitutes: SubstituteReviewItem[];
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: FAIL only where `lib/canvassing.ts` / UI still assume `pr1_id: string` or missing `source` — those are fixed in Tasks 3–4. If typecheck already passes because fields are optional, proceed.

- [ ] **Step 3: Commit**

```bash
git add types/canvassing.ts
git commit -m "$(cat <<'EOF'
feat(types): extend substitute review types for PR2-native parents
EOF
)"
```

---

### Task 3: Lib — list, detail, save, notify (parallel PR2 branches)

**Files:**
- Modify: `lib/canvassing.ts` (substitute section ~2225–2594 and submit-quote notify ~3148–3189)

#### 3A — `fetchSubstituteReviewBundles`

- [ ] **Step 1: Select `pr2_id` on RFQs; do not drop `pr1_id`**

Change the RFQ select from:

```ts
.select('id, rfq_number, status, pr1_id')
```

to:

```ts
.select('id, rfq_number, status, pr1_id, pr2_id')
```

- [ ] **Step 2: Split quotes into PR1-linked vs PR2-native**

After loading `rfqArr` / `supplierMap`:

```ts
const pr1Rfqs = rfqArr.filter(r => r.pr1_id);
const pr2Rfqs = rfqArr.filter(r => !r.pr1_id && r.pr2_id);

const pr1Ids = Array.from(new Set(pr1Rfqs.map(r => r.pr1_id as string)));
const pr2Ids = Array.from(new Set(pr2Rfqs.map(r => r.pr2_id as string)));
```

Keep the existing PR1 load + `bundlesByPr1` loop **unchanged** (same queries on `pr1_requests` / `pr1_items` / warehouse / awarded by `pr1_item_id`). Tag each returned bundle with `source: 'pr1'`.

- [ ] **Step 3: Add PR2 bundle builder beside it**

If `pr2Ids.length > 0`:

1. Load `pr2_requests` with  
   `id, pr2_number, purpose, department_name_snapshot, requisitioner_id, requisitioner_name_snapshot, priority`
2. Load `pr2_items` for quote `pr2_item_id`s (filter quotes where `pr2_item_id` and supplier’s RFQ is in `pr2Rfqs`)
3. Load `substitute_decisions` for those quote ids (same as today)
4. Load `supplier_item_selections` with `rfq_id, pr1_item_id, pr2_item_id` and build awarded keys as  
   `` `${rfq_id}|${pr2_item_id}` `` for PR2 lines
5. **Do not** call `fetchWarehouseProcurementByPr1Item` for PR2-native (no warehouse PR1 step) — use `pr2_items.quantity_requested` directly
6. Map header:

```ts
{
  source: 'pr2',
  pr1: {
    id: pr2.id,
    pr1_number: pr2.pr2_number,
    purpose: pr2.purpose,
    department_name_snapshot: pr2.department_name_snapshot,
    requisitioner_id: pr2.requisitioner_id,
    requisitioner_name_snapshot: pr2.requisitioner_name_snapshot,
    priority: pr2.priority ?? 'normal',
  },
  substitutes: [...],
}
```

Each substitute item:

```ts
{
  // ...
  pr1_item_id: null,
  pr2_item_id: item.id,
  original_description: item.description,
  original_quantity: Number(item.quantity_requested) || 0,
  is_awarded: awardedKeys.has(`${supplier.rfq_id}|${item.id}`),
}
```

- [ ] **Step 4: Return `pr1Bundles.concat(pr2Bundles)`**

Sort optional: by request number descending is fine; do not reorder inside PR1-only results relative to today’s behavior if both lists are empty of PR2 (pure PR1 env stays identical).

#### 3B — Detail loader

- [ ] **Step 5: Keep `fetchSubstituteBundleForPr1`; add PR2 sibling + resolver**

```ts
export async function fetchSubstituteBundleForPr2(
  pr2Id: string
): Promise<SubstituteReviewBundle | null> {
  const { data: pr2 } = await db
    .from('pr2_requests')
    .select('id, pr2_number, purpose, department_name_snapshot, requisitioner_id, requisitioner_name_snapshot, priority')
    .eq('id', pr2Id)
    .maybeSingle();
  if (!pr2) return null;
  return loadSubstitutesForPr2(pr2); // mirror loadSubstitutesForPr1 but eq('pr2_id', pr2.id), pr2_items, etc.
}

/** Detail page entry: try PR1 first (unchanged path), then PR2. */
export async function fetchSubstituteBundleForRequest(
  requestId: string
): Promise<SubstituteReviewBundle | null> {
  const pr1Bundle = await fetchSubstituteBundleForPr1(requestId);
  if (pr1Bundle) return { ...pr1Bundle, source: 'pr1' as const };
  return fetchSubstituteBundleForPr2(requestId);
}
```

Ensure `fetchSubstituteBundleForPr1` / `loadSubstitutesForPr1` still return `source: 'pr1'` (or the resolver wraps it). Do not change their query filters (`eq('pr1_id', pr1.id)`).

#### 3C — `saveSubstituteDecision`

- [ ] **Step 6: Resolve parent from quote’s RFQ; validate URL parent matches**

Replace signature usage so callers still pass the URL id, but the function validates:

```ts
export async function saveSubstituteDecision(
  quoteId: string,
  parentRequestId: string,
  decision: SubstituteDecision,
  notes: string,
  profile: UserProfile
): Promise<void> {
  const { data: quote } = await db
    .from('rfq_item_quotes')
    .select('id, rfq_supplier_id, is_alternative')
    .eq('id', quoteId)
    .maybeSingle();
  if (!quote) throw new Error('Quote not found.');
  if (!quote.is_alternative) throw new Error('Not an alternative quote.');

  const { data: rs } = await db
    .from('rfq_suppliers')
    .select('rfq_id, supplier_name_snapshot')
    .eq('id', quote.rfq_supplier_id)
    .maybeSingle();
  if (!rs?.rfq_id) throw new Error('RFQ assignment not found.');

  const { data: rfq } = await db
    .from('rfq_batches')
    .select('id, pr1_id, pr2_id, rfq_number')
    .eq('id', rs.rfq_id)
    .maybeSingle();
  if (!rfq) throw new Error('RFQ not found.');

  const isPr1 = !!rfq.pr1_id;
  const isPr2 = !rfq.pr1_id && !!rfq.pr2_id;
  if (!isPr1 && !isPr2) throw new Error('RFQ has no parent request.');

  const expectedParent = isPr1 ? rfq.pr1_id : rfq.pr2_id;
  if (parentRequestId !== expectedParent) {
    throw new Error('Substitute parent mismatch.');
  }

  const row = {
    rfq_item_quote_id: quoteId,
    pr1_id:     isPr1 ? rfq.pr1_id : null,
    pr2_id:     isPr2 ? rfq.pr2_id : null,
    decision,
    decided_by: profile.id,
    decided_at: new Date().toISOString(),
    notes:      notes.trim() || null,
  };

  const { error } = await db
    .from('substitute_decisions')
    .upsert(row, { onConflict: 'rfq_item_quote_id' });
  if (error) throw error;

  // audit_logs: keep existing shape; payload includes pr1_id and/or pr2_id
  // notifications: if isPr1 → existing PR1 requestor/procurement messages unchanged
  //                if isPr2 → same copy but label=pr2_number, action_url=`/substitutes/${pr2_id}`
}
```

**Constraint:** For `isPr1`, notification titles/bodies/URLs must remain identical to today’s PR1 strings (`/substitutes/${pr1Id}`, document_type `pr1`, etc.).

#### 3D — Submit-quote notifications

- [ ] **Step 7: Add PR2 sibling to the gated block**

Keep this exact gate for PR1:

```ts
if (rfq.pr1_id && alternativeCount > 0) {
  // ... existing requestor + procurement notify — DO NOT EDIT internals ...
}
```

Add immediately after:

```ts
else if (rfq.pr2_id && alternativeCount > 0) {
  const altLabel = `${alternativeCount} substitute item${alternativeCount !== 1 ? 's' : ''}`;

  if (requisitionerId) {
    const { data: existing } = await db
      .from('notifications')
      .select('id')
      .eq('user_id', requisitionerId)
      .eq('document_id', rfq.pr2_id)
      .eq('type', 'action_required')
      .eq('read', false)
      .ilike('title', 'Substitute Item%')
      .limit(1);

    if (!existing?.length) {
      await createNotification({
        user_id:       requisitionerId,
        title:         'Substitute Item Review Required',
        body:          `${supplierName} offered ${altLabel} for ${pr1Label}. Review and decide before procurement can award.`,
        type:          'action_required',
        document_type: 'pr2',
        document_id:   rfq.pr2_id,
        action_url:    `/substitutes/${rfq.pr2_id}`,
      });
    }
  }

  await notifyByRole(
    'procurement',
    {
      title:         'Substitute Items Pending Requestor Review',
      body:          `${supplierName} submitted ${altLabel} for ${pr1Label}. Award is blocked until the requestor decides.`,
      type:          'action_required',
      document_type: 'rfq',
      document_id:   rfq.id,
      action_url:    `/rfq/${rfq.id}`,
    },
    { dedupeUnreadForDocument: true }
  );
}
```

Remove or update the comment that says substitute review is “PR1-only / out of scope for raw material”.

- [ ] **Step 8: Typecheck**

```bash
npm run typecheck
```

Expected: PASS (or only UI `source` missing — fixed next).

- [ ] **Step 9: Commit**

```bash
git add lib/canvassing.ts
git commit -m "$(cat <<'EOF'
feat(canvassing): surface and decide PR2-native substitute quotes

Add parallel PR2 list/detail/save/notify branches beside the unchanged
PR1 substitute path so award is no longer a dead end for Planning RFQs.
EOF
)"
```

---

### Task 4: UI — index + detail

**Files:**
- Modify: `app/substitutes/page.tsx`
- Modify: `app/substitutes/[pr1Id]/page.tsx`

- [ ] **Step 1: Index — use shared detail URL (same path works for both ids)**

`fetchSubstituteReviewBundles` already returns `source`. Links stay:

```tsx
<Link href={`/substitutes/${bundle.pr1.id}`}>
```

Because detail resolver tries PR1 then PR2, both work. Optional badge:

```tsx
{bundle.source === 'pr2' && (
  <span className="text-[10px] uppercase tracking-wide text-pq-neutral-400">PR2</span>
)}
```

Search still matches `bundle.pr1.pr1_number` (mapped from `pr2_number` for PR2) — no filter rewrite required.

- [ ] **Step 2: Detail page — switch loader**

```ts
import {
  fetchSubstituteBundleForRequest,
  saveSubstituteDecision,
  isSubstituteActionable,
} from '@/lib/canvassing';

// in load():
fetchSubstituteBundleForRequest(pr1Id)
  .then(b => {
    if (!b) { setError('Request not found.'); return; }
    setBundle(b);
  })
```

Update empty-state / permission copy to say “this request” instead of hard-coding “this PR1” only where user-visible. Keep Accept/Reject calling:

```ts
await saveSubstituteDecision(substitute.quote_id, bundle.pr1.id, decision, notes, profile);
```

(`bundle.pr1.id` is the real PR2 id when `source === 'pr2'`.)

- [ ] **Step 3: Typecheck + lint touched files**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/substitutes/page.tsx app/substitutes/[pr1Id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(ui): load PR2-native bundles on Substitute Review pages
EOF
)"
```

---

### Task 5: End-to-end verification (evidence before done)

Use staging project `emddvbocupvufzvhcacz` and live RFQ-2026-0012 / PR2-2026-0012.

- [ ] **Step 1: SQL — alternative still present**

```sql
SELECT q.id, q.is_alternative, q.pr1_item_id, q.pr2_item_id, q.quoted_description
FROM rfq_item_quotes q
JOIN rfq_suppliers rs ON rs.id = q.rfq_supplier_id
WHERE rs.rfq_id = '9453a6c7-83c9-49ff-907f-543053d9b8db'
  AND q.is_alternative = true;
```

Expected: Safety Gloves row with `pr1_item_id` null.

- [ ] **Step 2: UI — requestor (Planning Demo User)**

1. Sign in as Planning Demo User (`requisitioner_id` on PR2-2026-0012).
2. Open `/substitutes` — PR2-2026-0012 appears with pending substitute.
3. Open detail — original Hex Bolts vs Safety Gloves; Accept or Reject works.
4. Confirm notification “Substitute Item Review Required” exists (or appears on next alt submit).

- [ ] **Step 3: UI — procurement (Ana Gomez)**

1. `/substitutes` shows the same PR2 bundle (procurement override path).
2. `/rfq/9453a6c7-...` — after Accept, “Awaiting decision” clears and Can Award becomes Yes for that alt (subject to catalog rules).
3. After Reject, selection stays blocked for that quote; other quotes unaffected.

- [ ] **Step 4: Regression — PR1 substitute path**

1. Find any existing PR1-originated RFQ with an alternative (or create a small goods PR1 → RFQ → alt quote).
2. Confirm `/substitutes` still lists it under the PR1 number.
3. Accept/reject still writes `pr1_id` NOT NULL and `pr2_id` NULL.
4. Procurement RFQ matrix award guard still works as before.

Verification SQL after a PR1 decision:

```sql
SELECT pr1_id IS NOT NULL AS has_pr1, pr2_id IS NULL AS no_pr2
FROM substitute_decisions
WHERE rfq_item_quote_id = '<pr1-alt-quote-id>';
-- expect has_pr1=true, no_pr2=true
```

After a PR2 decision:

```sql
SELECT pr1_id IS NULL AS no_pr1, pr2_id IS NOT NULL AS has_pr2
FROM substitute_decisions
WHERE rfq_item_quote_id = 'fb9d1e27-8072-4a65-b6c0-6717964243b6';
-- expect no_pr1=true, has_pr2=true
```

- [ ] **Step 5: Commit verification note (optional)**

Short entry in `docs/revision-progress.md` that the Phase-3 “substitute review PR1-only” limitation is lifted for PR2-native RFQs. Skip if that file is not used for this track.

---

## Out of scope / follow-ups (do not implement here)

| Item | Why deferred |
|------|----------------|
| Supplier inbox blank Purpose/Department (`fetchSupplierInboxPaged`) | Separate PR1-only join bug; already audited |
| Dust Mask line with `is_alternative=false` on mismatched steel | Catalog/manual quote product mismatch, not substitute visibility |
| Renaming route param `[pr1Id]` → `[requestId]` | Cosmetic; resolver makes current folder safe |
| Extending `substitute_decisions` audit UI / history | Not requested |

---

## Self-review checklist

| Audit requirement | Task |
|-------------------|------|
| Alt quotes appear in requestor Substitute Review | 3A, 3B, 4, 5.2 |
| Alt quotes appear for procurement Substitute Review | 3A, 4, 5.3 |
| Requestor can accept/reject | 1 (RLS), 3C, 5.2 |
| Procurement can accept/reject on behalf | existing procurement RLS + 3C |
| Notifications fire for PR2-native alts | 3D, 5.2 |
| Award unblocks after accept | existing matrix + 5.3 |
| PR1 path unchanged | Safety constraints + 5.4 |
| DB cannot store invalid dual/null parent | Task 1 CHECK |

No placeholders remain. Types `source`, `pr2_id`, and function names match across tasks.
