# PR2 Unwind Archive Column Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PR2 Request Revision and Reject succeed for warehouse-originated (goods/services) documents by syncing `pr2_requests_archive` with live `pr2_requests`, without changing PR1 / RFQ / PO / warehouse / raw-material flows.

**Architecture:** Two stacked migrations, then verify. Phase 1 adds the missing `priority` column so the current `INSERT … SELECT *` stops raising `42601`. Phase 2 replaces that positional copy with named-column inserts plus a preflight column-set check so the next live-only column add fails loudly instead of corrupting archive or breaking revision again. Application TypeScript is unchanged.

**Tech Stack:** Supabase Postgres migrations (`supabase/migrations/`), existing RPC `public.unwind_pr2_to_warehouse(uuid, boolean)` called from `lib/pr2-approvals.ts`. Verification via `execute_sql` (`INSERT … WHERE false`) and one goods PR2 revision/reject in the UI.

**Audit evidence (do not re-litigate):**
- Luisa’s Confirm on PR2 Request Revision returns Postgres `42601`: `INSERT has more expressions than target columns`
- `submitPR2ApprovalAction` records `approval_actions`, then calls `unwind_pr2_to_warehouse(pr1_id, false)` when `pr2.pr1_id` is set (`lib/pr2-approvals.ts`)
- Live RPC still does `INSERT INTO pr2_requests_archive SELECT * FROM pr2_requests`
- Live `pr2_requests` has 24 columns; `pr2_requests_archive` has 23. Missing archive column: `priority` (added to live only in `20260729000000_add_pr2_priority.sql`)
- Reproduced without writing rows: `INSERT INTO pr2_requests_archive SELECT * FROM pr2_requests WHERE false` → same `42601`. The items copy with `WHERE false` succeeds (29/29)
- No other archive tables exist. PR1 / RFQ / PO / warehouse revision paths do not use `INSERT … SELECT *`

---

## Safety constraints (non-negotiable)

These constrain every phase. If a change violates one, stop and revise the plan — do not “just ship it.”

1. **Fix only the PR2 warehouse unwind path.** Do not edit `lib/approvals.ts`, `lib/rfq-approvals.ts`, `lib/po-approvals.ts`, `lib/warehouse.ts`, `lib/pr1.ts` submit/revision, NotificationBell, AuthContext, or warehouse-remarks helpers.
2. **Do not change unwind business rules.** After the fix, the RPC must still: authorize approver; require PR1 status `pr2_pending_approval`; archive header then items; delete live items then live header; on `p_terminal = false` delete warehouse validation; set PR1 to `rejected` (terminal) or `approved_for_warehouse` (revision). Same `GRANT EXECUTE … TO authenticated`.
3. **Do not change who is unwound.** Only PR2 rows with a `pr1_id` go through this RPC. Raw-material PR2s without `pr1_id` must keep the existing TypeScript branch (status → `revision_requested` / `rejected` on the live PR2). Do not start unwinding those.
4. **Do not change approval UI or copy in Phase 1–2.** Leave `app/approvals/pr2/[id]/page.tsx` alone, including the “returned to Procurement” confirm text. That is a separate UX issue and must not ride this schema fix.
5. **Do not reorder `approval_actions` vs unwind in this plan.** The remark insert still happens first. Cleaning duplicate actions from Luisa’s retries is a manual data decision, not a migration.
6. **Do not alter live `pr2_requests` / `pr2_items`.** No drop, rename, type change, or new constraint on the live tables. Archive-only additive change in Phase 1.
7. **Do not tighten archive constraints beyond matching `priority`.** Do not add `cancelled` to the archive status check, do not add unique(`pr2_number`) on archive, do not make `rfq_id` NOT NULL (warehouse PR2s have `rfq_id = null`).
8. **Do not use `SELECT *` after Phase 2.** Named columns only. A future engineer who adds a live column and forgets archive must get a clear RPC exception, not silent omission and not a raw `42601`.
9. **Do not apply “cleanup” to other documents.** No PR1/RFQ/PO archive tables, no new RPCs, no shared unwind helper.
10. **Do not commit unless the user asks.** Create the files; leave git to the user.

---

## Out of scope (explicit)

- Confirm-dialog wording (“PR2 returned to Procurement” vs warehouse)
- Moving `approval_actions` insert after a successful unwind / wrapping client steps in a transaction
- Deleting or merging duplicate `approval_actions` from the failed retries
- Showing warehouse remarks (already shipped separately)
- Changing RFQ sync, PO generation, or print archive readers except to re-verify they still load

---

## File map

| File | Responsibility |
|------|----------------|
| Create: `supabase/migrations/20260903100000_pr2_requests_archive_add_priority.sql` | Add `priority` to archive only |
| Create: `supabase/migrations/20260903101000_unwind_pr2_named_column_insert.sql` | Replace positional `SELECT *` with named inserts + column-set guard |
| Unchanged: `lib/pr2-approvals.ts` | Still calls the same RPC with the same args |
| Unchanged: `app/approvals/pr2/[id]/page.tsx` | Same Confirm UI |

No new TypeScript modules. No RLS changes.

---

## Phase 0 — Lock evidence before editing

Do this immediately before writing migrations so the work still matches production.

- [x] **Step 1: Reconfirm the live mismatch**

Run:

```sql
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pr2_requests') AS live_request_cols,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pr2_requests_archive') AS archive_request_cols,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pr2_items') AS live_item_cols,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pr2_items_archive') AS archive_item_cols;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pr2_requests'
EXCEPT
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pr2_requests_archive';
```

Expected: `24 / 23 / 29 / 29`, and the only excepted column is `priority`.

If anything else appears, **stop**. Update this plan; do not add only `priority` and hope.

- [x] **Step 2: Reconfirm the failing statement**

```sql
INSERT INTO public.pr2_requests_archive SELECT * FROM public.pr2_requests WHERE false;
```

Expected: `ERROR 42601 INSERT has more expressions than target columns`

```sql
INSERT INTO public.pr2_items_archive SELECT * FROM public.pr2_items WHERE false;
```

Expected: success, 0 rows.

---

## Phase 1 — Unblock `42601` (schema only)

**Why this is its own phase:** adding `priority` at the end of `pr2_requests_archive` makes positional `SELECT *` line up with live (`priority` is already last on `pr2_requests`). That is the smallest change that makes today’s RPC work. Do not rewrite the function in the same migration.

### Task 1: Add `priority` to `pr2_requests_archive`

**Files:**
- Create: `supabase/migrations/20260903100000_pr2_requests_archive_add_priority.sql`

- [x] **Step 1: Write the migration exactly as follows**

```sql
-- Migration: 20260903100000_pr2_requests_archive_add_priority.sql
--
-- Live pr2_requests gained `priority` in 20260729000000. Archive was created
-- later without it. unwind_pr2_to_warehouse() copies with
--   INSERT INTO pr2_requests_archive SELECT * FROM pr2_requests
-- which raises 42601 (more expressions than target columns).
--
-- Additive archive-only change. Does not alter live pr2_requests.
-- Does not rewrite the RPC (see 20260903101000).

ALTER TABLE public.pr2_requests_archive
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pr2_requests_archive_priority_check'
  ) THEN
    ALTER TABLE public.pr2_requests_archive
      ADD CONSTRAINT pr2_requests_archive_priority_check
      CHECK (priority IS NULL OR priority IN ('normal', 'medium', 'high'));
  END IF;
END $$;
```

**Constraint notes:**
- Live `pr2_requests.priority` is nullable with default `'normal'` and `CHECK (priority IN ('normal', 'medium', 'high'))`. Archive must accept the same values. `IS NULL OR` keeps existing-null-safe if any row is inserted before default applies; live allows null.
- `IF NOT EXISTS` so a partial apply can be re-run.
- Do **not** `UPDATE` existing archive rows. Old archived PR2s can stay `normal` via default.

- [x] **Step 2: Apply this migration only**

Apply through the project’s existing Supabase migration path (repo file + remote apply). Do not apply Phase 2 yet.

- [x] **Step 3: Prove `42601` is gone while `SELECT *` is still in the function**

```sql
INSERT INTO public.pr2_requests_archive SELECT * FROM public.pr2_requests WHERE false;
INSERT INTO public.pr2_items_archive SELECT * FROM public.pr2_items WHERE false;

SELECT
  l.ordinal_position,
  l.column_name AS live_col,
  a.column_name AS archive_col
FROM information_schema.columns l
FULL OUTER JOIN information_schema.columns a
  ON a.table_schema = 'public'
 AND a.table_name = 'pr2_requests_archive'
 AND a.ordinal_position = l.ordinal_position
WHERE l.table_schema = 'public'
  AND l.table_name = 'pr2_requests'
ORDER BY COALESCE(l.ordinal_position, a.ordinal_position);
```

Expected: both inserts succeed (0 rows). Header columns match name-for-name in the same order, including `priority` at position 24.

If the positional insert still fails, **do not proceed to Phase 2**. Re-diff columns.

---

## Phase 2 — Stop the next column-add from breaking unwind

**Why this is a second phase:** `SELECT *` will work again after Phase 1, but the next live-only column (same class of mistake as `priority`) will recreate `42601`. Named inserts avoid that class of error. A column-set guard avoids the opposite failure: named inserts silently dropping a new live column.

### Task 2: Replace positional copy; keep all other RPC lines identical

**Files:**
- Create: `supabase/migrations/20260903101000_unwind_pr2_named_column_insert.sql`

- [x] **Step 1: Write the replacement function**

Copy the live function body. Change **only** the two `INSERT … SELECT *` lines and add the preflight block immediately before them. Do not rewrite comments, auth, PR1 status guard, deletes, or the terminal branch.

```sql
-- Migration: 20260903101000_unwind_pr2_named_column_insert.sql
--
-- Keep unwind_pr2_to_warehouse business rules identical.
-- Replace positional SELECT * copies with named columns so a future
-- live-only column cannot raise 42601. Refuse to run if column *names*
-- on live vs archive drift (named insert would otherwise drop data).

CREATE OR REPLACE FUNCTION public.unwind_pr2_to_warehouse(p_pr1_id uuid, p_terminal boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pr2_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'approver'
  ) THEN
    RAISE EXCEPTION 'Not authorized to unwind this PR2.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pr1_requests
    WHERE id = p_pr1_id AND status = 'pr2_pending_approval'
  ) THEN
    RAISE EXCEPTION 'PR1 is not awaiting PR2 approval.';
  END IF;

  SELECT id INTO v_pr2_id FROM public.pr2_requests WHERE pr1_id = p_pr1_id;

  IF v_pr2_id IS NOT NULL THEN
    IF EXISTS (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_requests'
      EXCEPT
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_requests_archive'
    ) OR EXISTS (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_requests_archive'
      EXCEPT
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_requests'
    ) THEN
      RAISE EXCEPTION 'pr2_requests and pr2_requests_archive column sets differ; refusing unwind';
    END IF;

    IF EXISTS (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_items'
      EXCEPT
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_items_archive'
    ) OR EXISTS (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_items_archive'
      EXCEPT
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_items'
    ) THEN
      RAISE EXCEPTION 'pr2_items and pr2_items_archive column sets differ; refusing unwind';
    END IF;

    INSERT INTO public.pr2_requests_archive (
      id, pr2_number, pr1_id, rfq_id,
      requisitioner_id, requisitioner_name_snapshot,
      department_id, department_name_snapshot,
      purpose, date_required,
      pr1_number_snapshot, rfq_number_snapshot,
      remarks, status, generated_by, generated_at,
      created_at, updated_at,
      prepared_by_id, prepared_by_name_snapshot,
      prepared_by_position_snapshot, prepared_at,
      request_type, priority
    )
    SELECT
      id, pr2_number, pr1_id, rfq_id,
      requisitioner_id, requisitioner_name_snapshot,
      department_id, department_name_snapshot,
      purpose, date_required,
      pr1_number_snapshot, rfq_number_snapshot,
      remarks, status, generated_by, generated_at,
      created_at, updated_at,
      prepared_by_id, prepared_by_name_snapshot,
      prepared_by_position_snapshot, prepared_at,
      request_type, priority
    FROM public.pr2_requests
    WHERE id = v_pr2_id;

    INSERT INTO public.pr2_items_archive (
      id, pr2_id, item_order, item_code, description, unit_of_measure,
      pr1_item_id, quantity_requested, qty_on_hand, qty_incoming,
      quantity_to_purchase, selected_rfq_supplier_id, supplier_name_snapshot,
      quoted_description, is_alternative, unit_price, lead_time_days,
      total_price, remarks, created_at, is_raw_material, quote_justification,
      rfq_item_quote_id, vat_type, vat_rate_applied,
      pr1_remarks_snapshot, pr1_quantity_requested_snapshot,
      quantity_override_reason_snapshot, quantity_overridden_by_name_snapshot
    )
    SELECT
      id, pr2_id, item_order, item_code, description, unit_of_measure,
      pr1_item_id, quantity_requested, qty_on_hand, qty_incoming,
      quantity_to_purchase, selected_rfq_supplier_id, supplier_name_snapshot,
      quoted_description, is_alternative, unit_price, lead_time_days,
      total_price, remarks, created_at, is_raw_material, quote_justification,
      rfq_item_quote_id, vat_type, vat_rate_applied,
      pr1_remarks_snapshot, pr1_quantity_requested_snapshot,
      quantity_override_reason_snapshot, quantity_overridden_by_name_snapshot
    FROM public.pr2_items
    WHERE pr2_id = v_pr2_id;

    DELETE FROM public.pr2_items WHERE pr2_id = v_pr2_id;
    DELETE FROM public.pr2_requests WHERE id = v_pr2_id;
  END IF;

  IF NOT p_terminal THEN
    DELETE FROM public.warehouse_validation_items
    WHERE validation_id IN (
      SELECT id FROM public.warehouse_validations WHERE pr1_id = p_pr1_id
    );
    DELETE FROM public.warehouse_validations WHERE pr1_id = p_pr1_id;
  END IF;

  UPDATE public.pr1_requests
  SET status = CASE WHEN p_terminal THEN 'rejected' ELSE 'approved_for_warehouse' END,
      updated_at = now()
  WHERE id = p_pr1_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unwind_pr2_to_warehouse(uuid, boolean) TO authenticated;
```

**Do not:**
- Change the function name, argument names, or `SECURITY DEFINER`
- Add warehouse-notes columns to archive (those are not on `pr2_*`)
- Insert into any table other than the two archive tables
- Touch `lib/pr2-approvals.ts`

- [x] **Step 2: Apply Phase 2 only after Phase 1 verification passed**

- [x] **Step 3: Confirm the live function no longer contains `SELECT *`**

```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'unwind_pr2_to_warehouse';
```

Expected: named `INSERT` lists include `priority`; no `INSERT INTO public.pr2_requests_archive SELECT *`.

---

## Phase 3 — Verify the user-visible paths (and only those)

Do not test PR1 / RFQ / PO revision as part of “did we break them” by changing them. They were never on this RPC. Regression here is: **goods PR2 revision works; goods PR2 reject works; raw-material PR2 revision still does not call unwind.**

### Task 3: Static confirm the TypeScript call sites are untouched

- [x] **Step 1: Confirm call sites**

```bash
rg "unwind_pr2_to_warehouse" -g "*.ts" -g "*.tsx" -g "*.sql"
```

Expected:
- `lib/pr2-approvals.ts` — reject: `{ p_terminal: true }`; revision: `{ p_terminal: false }`
- The two new migrations plus the older `20260731073500_update_unwind_rpc_to_archive.sql`

No new callers.

- [x] **Step 2: Confirm unrelated approval writers were not edited**

```bash
git diff --stat
```

Expected files: the two new SQL migrations only (plus this plan if it was untracked). If `lib/approvals.ts`, `lib/rfq-approvals.ts`, `lib/po-approvals.ts`, or `lib/warehouse.ts` appear, revert them.

### Task 4: Manual QA (browser, goods PR2)

Use a **non-production-critical** goods/services PR2 that is in PR2 approval (`PR1.status = pr2_pending_approval`), not Luisa’s live document if you cannot afford a full unwind.

- [ ] **Step 1: Request Revision**

1. Sign in as an authorized PR2 approver (Department Head on the active step).
2. Open `/approvals/pr2/{instanceId}`.
3. Request Revision with a remark.
4. Confirm.

Expected:
- No `42601` banner
- Redirect to `/approvals/pr2`
- Live `pr2_requests` row for that PR2 is gone
- Same id exists in `pr2_requests_archive` with `priority` populated
- Matching rows in `pr2_items_archive`
- PR1 status is `approved_for_warehouse`
- Warehouse validation for that PR1 is cleared
- Warehouse queue shows the PR1 again

- [ ] **Step 2: Reject (separate document)**

Repeat on a **different** goods PR2 with Reject.

Expected:
- No `42601`
- PR2 archived and live row gone
- PR1 status `rejected`
- Warehouse validation **left in place** (`p_terminal = true`)

- [ ] **Step 3: Raw-material sanity (do not unwind)**

If a planning/raw-material PR2 without `pr1_id` is available, Request Revision.

Expected:
- Live PR2 remains; status becomes `revision_requested`
- No new `pr2_requests_archive` row for that id

- [ ] **Step 4: Read-path smoke**

Open an already-archived PR2 print/approval view if one exists (`fetchPR2ForPrint` / `pr2_requests_archive`). Confirm it still loads. Do not change those readers.

---

## Rollback

- **Phase 1 only applied:** `ALTER TABLE pr2_requests_archive DROP CONSTRAINT IF EXISTS pr2_requests_archive_priority_check; ALTER TABLE pr2_requests_archive DROP COLUMN IF EXISTS priority;` — only if Phase 2 was not applied and no new archive rows depend on the column.
- **Phase 2 applied:** restore the previous function body from `supabase/migrations/20260731073500_update_unwind_rpc_to_archive.sql` via a new `CREATE OR REPLACE`. Do not drop archive tables.
- **Do not** drop `priority` from live `pr2_requests`.

---

## Later work (separate plans only)

Do not implement these in the same session as Phases 1–3:

1. **Confirm copy** — “returned to Procurement” is wrong for warehouse unwind. Touch only `app/approvals/pr2/[id]/page.tsx` copy.
2. **Action-before-unwind** — `approval_actions` is inserted before the RPC, so a later unwind failure still leaves extra action rows. Any fix must preserve a successful revision’s visible remark.
3. **Retry leftovers** — Luisa’s three failed Confirms may have written three `approval_actions`. Inspect before deleting.

---

## Self-review

| Audit requirement | Task |
|---|---|
| Stop `42601` on goods PR2 revision | Phase 1 |
| Same RPC used by Reject | Phase 3 Task 4 Step 2 |
| Do not break PR1/RFQ/PO | Constraints 1, 9; Phase 3 Task 3 |
| Do not change unwind routing/status rules | Constraint 2; Phase 2 copies body |
| Prevent the next live-only column from repeating this | Phase 2 named insert + column-set guard |
| Do not silently drop new columns after named insert | Phase 2 `EXCEPT` preflight |
| Do not mix UX / action-order / data cleanup | Out of scope + Later work |
