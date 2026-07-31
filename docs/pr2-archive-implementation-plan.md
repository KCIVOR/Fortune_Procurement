# PR2 Archive Implementation Plan

## Goal
Implement an Archive Tables architecture for unwound PR2s. This allows approvers to retain full UI traceability (timeline, items, remarks) for rejected PR2s in their Approval History, without breaking the strict `UNIQUE(pr1_id)` constraints on warehouse validations or crashing `maybeSingle()` queries globally.

---

## 🚨 READ THIS BEFORE TOUCHING ANY CODE (RULES FOR AI) 🚨
1. **STRICT SURGICAL EDITS:** Implement ONLY what is described in this plan. Do not touch any file that isn't named in the current phase.
2. **NO UNRELATED REFACTORING:** Do not clean up imports, reformat code, or rename variables that are outside the exact scope of the task. If it looks wrong but isn't part of this plan, leave it alone.
3. **PRESERVE `maybeSingle()`:** Never change existing `.eq('pr1_id', pr1Id).maybeSingle()` logic anywhere in the codebase. The purpose of this archive is to keep the live tables clean so these queries continue to work perfectly.
4. **NO NEW UNIQUE CONSTRAINTS:** The archive tables (`pr2_requests_archive`, `pr2_items_archive`) must NOT have `UNIQUE(pr1_id)` constraints. Multiple archived PR2s can point to the same PR1.
5. **MIRROR RLS EXACTLY:** The RLS policies on the archive tables must be exact 1:1 copies of the live table RLS policies.

---

## Phase 1: Database Schema (Archive Tables)
**Files:** `supabase/migrations/[timestamp]_pr2_archive_schema.sql` (Create new)

1. Create `pr2_requests_archive` table with the exact same columns as `pr2_requests`.
2. Create `pr2_items_archive` table with the exact same columns as `pr2_items`.
3. Add foreign keys to `pr1_requests` and `rfq_batches` as appropriate.
4. Do NOT add `UNIQUE(pr1_id)` to the archive.
5. Mirror the exact RLS policies from `20260424013414_pr2_schema.sql` for Procurement, Approvers, and Requestors onto both archive tables.
6. Enable RLS on both archive tables.

## Phase 2: RPC Modification
**Files:** `supabase/migrations/[timestamp]_update_unwind_rpc_to_archive.sql` (Create new)

1. `CREATE OR REPLACE FUNCTION public.unwind_pr2_to_warehouse(p_pr1_id uuid, p_terminal boolean)`
2. Locate the block that deletes the PR2:
   ```sql
   IF v_pr2_id IS NOT NULL THEN
     DELETE FROM public.pr2_items WHERE pr2_id = v_pr2_id;
     DELETE FROM public.pr2_requests WHERE id = v_pr2_id;
   END IF;
   ```
3. Update it to INSERT into the archives before DELETING:
   ```sql
   IF v_pr2_id IS NOT NULL THEN
     INSERT INTO public.pr2_requests_archive SELECT * FROM public.pr2_requests WHERE id = v_pr2_id;
     INSERT INTO public.pr2_items_archive SELECT * FROM public.pr2_items WHERE pr2_id = v_pr2_id;
     
     DELETE FROM public.pr2_items WHERE pr2_id = v_pr2_id;
     DELETE FROM public.pr2_requests WHERE id = v_pr2_id;
   END IF;
   ```

## Phase 3: Types Update
**Files:** `types/approvals.ts`

1. Add `is_archived?: boolean;` to the `PR2ApprovalDetail` interface.

## Phase 4: Data Fetching (pr2-approvals)
**Files:** `lib/pr2-approvals.ts`

1. Inside `fetchPR2ApprovalDetail`, the code currently queries `pr2_requests` and throws/returns null if it is missing.
2. Update the logic: If the query to `pr2_requests` yields no data, run the exact same query against `pr2_requests_archive`.
3. If it finds the data in `pr2_requests_archive`, set `is_archived: true` on the returned data object.
4. When fetching the items for the detail view, check if `pr2.is_archived` is true. If so, query `pr2_items_archive` instead of `pr2_items`.

## Phase 5: Approval History Resolution
**Files:** `lib/approval-history.ts`

1. Inside `fetchMyApprovalHistoryPaged`, it currently maps PR2 Numbers using:
   ```typescript
   const pr2Res = pr2Ids.size > 0
     ? await db.from('pr2_requests').select('id, pr2_number, request_type').in('id', Array.from(pr2Ids))
     : { data: [] as any[], error: null };
   ```
2. Update this logic: After getting `pr2Res`, check if there are any missing IDs (where `pr2Ids` has an ID that isn't in `pr2Res.data`).
3. If there are missing IDs, query `pr2_requests_archive` for those specific missing IDs.
4. Combine the results from both queries so that the history table correctly displays the `pr2_number` instead of `—`.

## Phase 6: UI Adjustments
**Files:** `app/approvals/pr2/[id]/page.tsx`

1. Below the `DetailHeaderLayout`, add a conditional banner if `detail.is_archived` is true.
   - The banner should be styled like a warning (amber/yellow) and say: *"This PR2 was rejected and archived. It has been returned to the warehouse for revision and cannot be acted upon."*
2. Hide the Action Panel (the Approve/Reject buttons) entirely if `detail.is_archived` is true. We only want them to see the timeline, not take action.
