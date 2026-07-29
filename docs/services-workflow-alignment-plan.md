# Services Workflow Alignment — Surgical Implementation Plan

**Goal:** Align the **Services** requisition flow with `docs/Final_Workflow.md` (Services section, steps 1a/1b–24). Services currently runs on the same **legacy PR1→RFQ-first→PR2-after** pipeline that Goods used before its own alignment (see `docs/goods-workflow-alignment-plan.md`, already shipped). This plan applies the identical corrective pattern to `request_type = 'services'`, plus the two genuine Services-specific deltas the spec calls out (dual entry point, Procurement-performed GRN).

**Scope:** `request_type = 'services'` only. Every task below is written as an *additive broadening* of an existing `goods`-only (or `goods`/`raw_material`-only) condition, not a rewrite — Goods and Raw Material code paths are only touched where the existing condition is a literal enumeration that needs one more value added. No shared table is dropped or restructured.

**Verified starting state (2026-07-30, live DB `emddvbocupvufzvhcacz` + codebase):**
- Zero `services` rows exist anywhere (`pr1_requests`, `pr2_requests`, `rfq_batches`, `po_requests` all `count = 0`). **This means every change below is safe to make directly — no backfill/migration of live data is required, unlike the Goods alignment which needed a Phase 0 wipe.**
- `PR2_FINAL` (Dept Head → Operations Manager, 2 steps) and `RFQ_APPROVAL` (Procurement Manager → Director, 2 steps) both already exist and are `active: true` — no new workflow codes needed for Phases 1–7.
- `PR2_PHASE1` (Procurement Staff → Procurement Manager → Director) remains active for legacy/fallback use; Services is the only remaining thing routed there today.

---

## Decision log — confirm before implementing the gated phases

| # | Question | Status | Default if unconfirmed |
|---|----------|--------|-------------------------|
| **D1** | `Final_Workflow.md` §2 states "No Quality Assurance (TSQA) approval step applies to Services," but §5.7 steps 17–20 describe Warehouse reviewing, an explicit "Forward" button, and **TSQA (Approver)** inspecting/approving flagged services. | **RESOLVED (2026-07-30):** follow §5.7 — TSQA is involved for Services, same as Goods/Raw Material. |
| **D2** | §5.8 says "certain services (e.g., calibration)" require compliance documentation before receipt can finalize; how is this flagged, and does it block receipt? | **RESOLVED (2026-07-30):** the compliance-document requirement is **optional per service** (not every service needs it, and it does not hard-block GRN closure the way §5.8 step 24 literally states — it is a soft/optional feature). Additionally: **the Documentation/Certification upload page must only be visible to suppliers tagged `supplier_supply_type = 'service'`** — confirmed this field already exists (`profiles.supplier_supply_type`, `CHECK IN ('raw_material','normal','service')`, migration `20260713194444_profiles_supplier_supply_type.sql`) and is already used as a UI gate elsewhere (`components/dashboards/SupplierDashboard.tsx:57`, `components/layout/Sidebar.tsx:110` both branch on `profile.supplier_supply_type === 'raw_material'` today — the service-supplier equivalent follows the identical pattern). |

Phases 1–7 have no open questions — every behavior below is either directly stated in `Final_Workflow.md` or confirmed by reading the live workflow/RLS/code together. Phases 8–9 are now unblocked and detailed below.

---

## Deployment bundles

Phases must ship in these groups — shipping one alone would leave a Services PR1 in a dead end (mirrors the reasoning in the Goods plan's Bundle B).

| Bundle | Phases | Why |
|--------|--------|-----|
| **A** | 1 + 2 | PR2 routing fix + Warehouse-creates-PR2 must land together — Phase 2 alone would create PR2s that then get routed to the wrong (legacy) approval chain by Phase-1's *unfixed* condition. |
| **B** | 4 + 5 | RFQ-creation eligibility gate + canvassing-queue filter must land together — Phase 4 alone makes `for_canvassing` unreachable for new records but leaves the queue still looking for it. |
| **C** | 3 | Planning-direct Services PR2 entry — standalone, additive, no dependency on A/B. |
| **D** | 6 | PO-generation RFQ-approval gate — standalone. |
| **E** | 7 | Manual Send PO — standalone, but touches 5 files; ship as one commit (partial application breaks the supplier inbox). |
| **F** | 8 | GRN TSQA flagging for Services (per D1) |
| **G** | 9 | Compliance documentation (per D2) |
| **H** | 10 | Legacy cleanup (dead code removal, docs) — do last, after A–G are live and verified. |

---

## Phase 1 — PR2 approval routing fix (Bundle A)

**Problem:** `submitPR2ForApproval` (`lib/pr2-approvals.ts:85-96`) only routes to `PR2_FINAL` when the linked PR1 is `goods`. Everything else — including `services` — falls through to the legacy `PR2_PHASE1` default. Spec §5.3 (steps 5–6) wants Services on the identical Dept Head → Operations Manager chain Goods uses.

**Files:** `lib/pr2-approvals.ts`

- [ ] In `submitPR2ForApproval`, broaden the PR1-linked branch:
  ```ts
  // before
  if (pr1Row?.request_type === 'goods') workflowCode = 'PR2_FINAL';
  // after
  if (pr1Row?.request_type === 'goods' || pr1Row?.request_type === 'services') workflowCode = 'PR2_FINAL';
  ```
- [ ] Add the direct-entry branch for when Phase 3 lands (Planning-direct Services PR2, no `pr1_id`) — safe to add now as a no-op until Phase 3 ships:
  ```ts
  else if (pr2.request_type === 'services' && !pr2.pr1_id) {
    workflowCode = 'PR2_FINAL';
  }
  ```
- [ ] No RLS change needed — confirmed live: `Approvers can read/update own department PR2 requests` already scopes by `department_id` for non-director positions and bypasses for `Director/Finance Director/Operations Manager`, which already covers a services PR2's Dept Head/Ops Manager approvers correctly.

**Verification:** Create a test `services` PR1 → have Warehouse mark insufficient (once Phase 2 lands) → confirm the resulting PR2's `submitPR2ForApproval` starts a `PR2_FINAL` instance (Dept Head step first), not `PR2_PHASE1`.

---

## Phase 2 — Warehouse creates PR2 for Services (Bundle A)

**Problem:** Spec §5.2 step 4 (Services) explicitly says Warehouse "advances the request from PR1 to PR2, creates the PR2, and is recorded as Prepared By — **the same handoff role Warehouse performs for Goods requests.**" Current code (`lib/pr2-warehouse.ts:51-53`) throws `'Warehouse PR2 creation is only supported for Goods requests.'` for anything but `goods`, and `lib/warehouse.ts:540` (`isGoodsInsufficient`) instead routes services to `for_canvassing` with no PR2 — a fundamentally different (legacy) shape.

**Files:** `lib/pr2-warehouse.ts`, `lib/warehouse.ts`, new migration.

- [ ] `lib/pr2-warehouse.ts`: broaden the guard at line 51:
  ```ts
  if (pr1.request_type !== 'goods' && pr1.request_type !== 'services') {
    throw new Error('Warehouse PR2 creation is only supported for Goods and Services requests.');
  }
  ```
  Update the file's doc comment (currently "Goods only") accordingly.
- [ ] `lib/warehouse.ts`: rename/broaden `isGoodsInsufficient` (line 540) to reflect both types now create a PR2:
  ```ts
  const createsPR2 = decision === 'insufficient' && (requestType === 'goods' || requestType === 'services');
  ```
  Replace the two other usages (`if (isGoodsInsufficient)` at line 594, `!isGoodsInsufficient` at line 678) with `createsPR2` / `!createsPR2`. The `for_canvassing` transition at lines 601-604 and its "notify procurement to canvass" block (676-689) become unreachable for both `goods` and `services` after this — leave the code in place (it's now dead but harmless; do not delete yet, see Phase 10) since `raw_material` never reaches this function (no PR1) and no other caller depends on `for_canvassing` being reachable from here.
  Update the error message at line 596 ("PR2 number is required when routing Goods to procurement") to say "Goods/Services."
- [ ] New migration: broaden `warehouse_insert_pr2_requests_goods` and `warehouse_update_pr2_requests_goods` RLS policies (or add sibling policies) so the `pr1.request_type = 'goods'` check also accepts `'services'`. Apply via Supabase MCP `apply_migration`, then rename the local migration file to the MCP-assigned timestamp (established project practice — see `supabase-migration-practice` memory).

**Verification:** Submit a `services` PR1 through Supervisor → Dept Head approval → Warehouse validation (insufficient) → confirm a `draft` PR2 is created with `prepared_by_id` = the warehouse user, PR1 status → `pr2_pending_approval`, and (per Phase 1) the PR2's approval instance is `PR2_FINAL`.

---

## Phase 3 — Planning-direct Services PR2 entry point (Bundle C)

**Problem:** Spec §5.1 step 1b: Services may also enter directly at PR2 via Planning, "no PR1 required, consistent with the Raw Materials entry rule." Today `lib/pr2-planning.ts` and its RLS policies are hard-coded to `request_type = 'raw_material'` only.

**Files:** `lib/pr2-planning.ts`, `app/planning/pr2/**`, new migration.

- [ ] New migration: broaden the three raw-material-scoped Planning RLS policies on `pr2_requests` (`Planning can insert/update/delete own draft raw material PR2 requests`) from `request_type = 'raw_material'` to `request_type IN ('raw_material', 'services')`. Same Planning-role/position condition (`position.title = 'Planning Staff' OR department.code = 'PLAN'`) — no other change.
- [ ] `lib/pr2-planning.ts`: add an explicit `requestType: 'raw_material' | 'services'` parameter to the create/fetch/update/delete functions, with existing call sites passing `'raw_material'` unchanged (no behavior change for the shipped raw-material flow). Reject any other value at the top of each function (mirrors the existing `if (pr2.request_type !== 'raw_material') throw` guards, just widened to the two allowed values).
- [ ] `app/planning/pr2/new` (and list/detail): add a Request Type selector (Raw Material / Services), defaulting to Raw Material to preserve current UX. When Services is selected, pass `request_type: 'services'` through; item-line labels ("Item Code" etc.) may need conditional copy but no schema change — `pr2_items` is already generic across all three request types.

**Verification:** As a Planning user, create a Services PR2 directly (no PR1), submit it, confirm (via Phase 1) it routes to `PR2_FINAL`; confirm a Raw Material PR2 created immediately after still behaves identically to before this phase.

---

## Phase 4 — RFQ creation eligibility (Bundle B)

**Problem:** `createRfq()` (`lib/canvassing.ts:1076-1093`) only gates on `pr2_approved` + an approved linked PR2 when `request_type === 'goods'`. Once Phase 2 makes Services create its PR2 *before* RFQ (same as Goods), Services must pass through the identical gate — otherwise Procurement could open an RFQ before the PR2 is even approved.

**Files:** `lib/canvassing.ts`

- [ ] Broaden the gate:
  ```ts
  // before
  const isGoods = pr1Header.request_type === 'goods';
  ...
  if (isGoods) { ... }
  // after
  const requiresApprovedPR2 = pr1Header.request_type === 'goods' || pr1Header.request_type === 'services';
  ...
  if (requiresApprovedPR2) { ... }
  ```
  (Keep the variable renamed consistently through the function — it currently reads `isGoods`/`linkedPr2Id` in three places; rename `isGoods` → `requiresApprovedPR2`, leave `linkedPr2Id` logic untouched since it's already generic.)
- [ ] No change needed to `createRfqFromPr2` (raw-material sibling) — unaffected.

**Verification:** Attempt to create an RFQ for a `services` PR1 whose PR2 is not yet `approved` → must throw the same error Goods gets today. After PR2 approval, RFQ creation succeeds and links `rfq_id`/`pr2_id` bidirectionally, same as Goods.

---

## Phase 5 — Canvassing queue filter (Bundle B)

**Problem:** `CANVASSING_QUEUE_OR_FILTER` (`lib/canvassing.ts:34`) still expects Services PR1s at `for_canvassing`/`canvassing_complete` — statuses that, after Phases 1–2, a Services PR1 will never reach again (it now goes `pr2_pending_approval` → `pr2_approved`, same as Goods).

**Files:** `lib/canvassing.ts`

- [ ] Change:
  ```ts
  // before
  'and(request_type.eq.goods,status.eq.pr2_approved),and(request_type.eq.services,status.in.(for_canvassing,canvassing_complete))'
  // after
  'and(request_type.in.(goods,services),status.eq.pr2_approved)'
  ```
- [ ] Update `fetchProcurementStats()` (`lib/canvassing.ts:3096-3119`). Confirmed exact current shape: `forCanvassing` already sums a `for_canvassing`+`services` count (`queueRes`) with a `pr2_approved`+`goods` count (`goodsReadyRes`, line 3109) — after this phase, drop `queueRes` and instead add a `pr2_approved`+`services` count into that same sum (i.e. `goodsReadyRes` becomes a combined "ready for RFQ" count across both types, or add a sibling query and sum both). `highRes`/`mediumRes` (lines 3107-3108) currently count **services-only** priority breakdowns at `for_canvassing` — change their `.eq('status', ...)` to `pr2_approved`; note there is no equivalent goods priority breakdown in this function today, so decide whether these two counts should now include goods PR1s too (they arguably should, since the queue itself is now type-blind) — this is a small UI-scope call, not a spec question, safe to decide during implementation. `canvassingComplete` (`completeRes`, line 3106) has **no goods equivalent to mirror** — under the corrected flow, "canvassing complete" is no longer a PR1 status transition at all (RFQ open/closed is tracked on `rfq_batches.status` directly, same as Goods), so this stat should be repurposed to count `rfq_batches` with `status = 'closed'` and no PO yet generated (join through `pr2_requests`/`po_requests`), scoped to `services` (or dropped if the dashboard card it feeds isn't needed once the flow matches Goods).

**Verification:** Re-run the same live-data check used in the earlier canvassing-queue audit (badge count vs. list count) for a test Services PR1 sitting at `pr2_approved` — confirm it appears in "Awaiting RFQ" and disappears once an RFQ exists, exactly like Goods does today.

---

## Phase 6 — PO generation: require RFQ approval for Services too (Bundle D)

**Problem:** `fetchPOGenerationCandidates()` and `generatePOFromPR2()` (`lib/po.ts:267-268` and `540-553`) explicitly skip the "RFQ must be Director-approved" gate for `services`. That carve-out was only correct under the legacy flow (where by the time a Services PR2 existed, its RFQ was already closed with no formal approval relationship). Under the corrected flow, Services RFQs go through `RFQ_APPROVAL` exactly like Goods, so the gate should apply uniformly.

**Files:** `lib/po.ts`

- [ ] Broaden `needsRfqApprovalGate` (line 267-268) and the equivalent inline check (line 545) from `request_type === 'goods' || request_type === 'raw_material'` to include `'services'` — i.e., apply to all three types, removing the exception rather than adding one.

**Verification:** Attempt to generate a PO from an `approved` Services PR2 whose RFQ has not yet completed `RFQ_APPROVAL` → must be blocked with the same message Goods gets. After RFQ approval, PO generation succeeds.

---

## Phase 7 — Manual "Send to Supplier" gate for Services (Bundle E)

**Problem:** Spec §5.5 step 13 (Services) requires the identical manual-send action Goods/Raw Material have (§5.4 step 13 / §5.3 step 10 respectively) — "a deliberate manual action; the PO is not sent automatically after approval." Today Services is explicitly carved out of this in **five** places, all of which must change together:

**Files:** `lib/po-send.ts`, `lib/po-approvals.ts`, `app/po/[id]/page.tsx`

- [x] `lib/po-send.ts:44-47` — remove the throw that blocks `sendPOToSupplier` for services:
  ```ts
  // delete this block entirely — manual send now applies to all three types
  const requestType = await resolvePORequestType(poId);
  if (requestType !== 'goods' && requestType !== 'raw_material') {
    throw new Error('Manual send applies to Goods and Raw Material POs only.');
  }
  ```
- [x] `lib/po-approvals.ts:711-717` (`supplierInboxVisible`) — `requiresManualSend` currently `row.pr2?.request_type === 'goods' || row.pr2?.request_type === 'raw_material'`; change to always `true` (all three types now gate on `sent_at`), i.e. simplify to `if (!row.sent_at) return false;` after the `status === 'sent'` short-circuit.
- [x] `lib/po-approvals.ts:488-521` — remove the "services notify supplier immediately on final PO approval" block entirely; Services now follows the same pattern as Goods/Raw Material, where the supplier notification fires from `sendPOToSupplier` on manual send (already implemented, lines 64-74 of `lib/po-send.ts`), not at approval time.
- [x] `lib/po-approvals.ts:863` (`acknowledgeSupplierPO`) — broaden `(requestType === 'goods' || requestType === 'raw_material') && !po.sent_at` to apply to all three types (or simply `!po.sent_at`, since the type check becomes redundant once all three require it).
- [x] `app/po/[id]/page.tsx:167` — remove the `(po.request_type === 'goods' || po.request_type === 'raw_material')` restriction gating the visible "Send to Supplier" button so it also shows for `services`.

**Verification:** Approve a Services PO end-to-end → confirm the supplier does **not** see it in their inbox and receives no notification until Procurement explicitly clicks Send; confirm Send then behaves identically to the existing Goods flow (notification fires once, `sent_at` set, inbox visibility flips).

---

## Phase 8 — Services GRN: TSQA flagging (Bundle F)

**Much smaller than originally scoped.** Re-reading `lib/grn.ts` end to end shows the QA mechanism (`requires_qa`/`qa_status` columns on `grn_items`, `evaluateGRNQAStatus()`, the `pending_qa` gate on `closeGRN()`, and the TSQA notify-by-role call) is **already fully generic** — it doesn't check `request_type` anywhere. It already works exactly like Goods' own "may flag a specific item even though not raw material" rule (spec §5.1 step 18): `is_raw_material` just forces the flag on for raw-material lines; every other line (goods or services) is manually flaggable. Confirmed live: the TSQA queue/detail pages (`app/tsqa/grn/page.tsx`, `app/tsqa/grn/[id]/page.tsx`) already query by `requires_qa`/`qa_status` with no type filter — they'll pick up a flagged services line with zero changes.

The **one actual gap**: the checkbox that lets Warehouse/Procurement flag a line as `requires_qa` is hard-gated to `grn.request_type === 'goods'` in the GRN detail page — `app/grn/[id]/page.tsx:495` and `:592`. For Raw Material this checkbox is correctly hidden (the flag is forced, not optional); for Services it's currently hidden too, which is the bug — Services needs the same optional, case-by-case checkbox Goods has.

**Files:** `app/grn/[id]/page.tsx`

- [x] Line 495 and line 592: broaden `grn.request_type === 'goods'` to `grn.request_type === 'goods' || grn.request_type === 'services'` so the `requires_qa` checkbox renders (and is editable) for services GRN lines. `canHandle` (line 58, already `services ? isProcurement : isWarehouse`) already gates who can check it — no change needed there.
- [x] Update the TSQA queue page's description copy (`app/tsqa/grn/page.tsx:53`, currently "Inspect and approve warehouse-flagged **goods** receipt items") to not imply goods-only, since it will now also surface services lines.
- [x] **No backend/lib changes required** — `saveGRNProgress`, `closeGRN`, `evaluateGRNQAStatus`, and the TSQA notification are confirmed already type-agnostic.
- [x] **Forward button (§5.7 steps 17-18):** not building a separate literal "Forward" button. The functional outcome it describes — Procurement, not Warehouse, owns the GRN for a service — is already achieved today by the existing role gate (`canOpenGRN`/`canHandle` in both the delivery page and GRN page already route services to `isProcurement`). Flagging this interpretation explicitly rather than silently assuming it: if a distinct hand-off action is wanted later (e.g., because some services *should* be receivable by Warehouse without ever involving Procurement), that would be a new decision to raise separately — nothing in the current confirmed decisions calls for it.

**Verification:** On a services GRN, confirm Procurement can check "Requires QA" on a specific line, save, see the GRN flip to `pending_qa`, confirm TSQA is notified and the item appears in `/tsqa/grn`, confirm TSQA approval clears the flag and the GRN can close — mirror the existing Raw Material manual test exactly, just with a services PO/GRN.

---

## Phase 9 — Compliance documentation (Bundle G)

Spec §5.8: supplier uploads compliance docs (e.g., Certificate of Calibration) to a dedicated Documentation/Certification page on the Supplier Dashboard. Per D2: this is **optional per service** (not a hard block on GRN closure), and the upload page itself must only be reachable by suppliers where `profiles.supplier_supply_type = 'service'`.

**Files:** new migration, `lib/` (new or extended module), new supplier-facing page, `components/layout/Sidebar.tsx`, `components/dashboards/SupplierDashboard.tsx`.

- [x] New migration: add `requires_compliance_doc boolean not null default false` to `supplier_products` (the flag lives on the catalog service item, set by the supplier or Procurement) — mirrors how `is_raw_material` already lives on `pr2_items`/`po_items` as a snapshot rather than a live join. Snapshot this same flag onto `pr2_items` and `po_items` at generation time (same pattern `is_raw_material` already uses through `generatePR2FromRfq`/warehouse PR2 creation/PO generation), so a PO line remembers whether it required compliance docs even if the catalog item changes later.
- [x] New table `compliance_documents` (or similar): `id, po_id, po_item_id, supplier_id, document_type, file_path, uploaded_at` + storage bucket + RLS — supplier can insert/read own rows (`supplier_id = auth.uid()`), Procurement can read all. Follow the existing `pr2_item_attachments` migration (already shipped in this repo) as the structural template for the storage-bucket + RLS shape.
- [x] New supplier-facing page (e.g. `app/supplier/compliance-documents/page.tsx`) — gate visibility the same way `SupplierDashboard.tsx:57` and `Sidebar.tsx:110` already gate raw-material-only UI: `profile.supplier_supply_type === 'service'`. List POs awaiting/having compliance docs; upload action per PO item flagged `requires_compliance_doc`.
- [x] Procurement-facing: surface "Compliance doc: pending/received" as an informational badge on the services GRN/PO detail — **optional, not a blocking gate** on `closeGRN()` per D2 (do not add a throw/guard there; this is visibility only, unlike §5.8 step 24's literal wording).
- [x] Sidebar nav entry for the new page, gated identically (`supplier_supply_type === 'service'`).

**Verification:** Tag a test supplier `supplier_supply_type = 'service'`, flag a catalog service `requires_compliance_doc = true`, confirm the upload page appears only for that supplier (not for a `raw_material` or `normal` supplier), confirm the document can be uploaded and is visible to Procurement, and confirm GRN closure is **not** blocked by its absence.

---

## Phase 10 — Legacy cleanup (Bundle H — do last)

Only after Phases 1–7 (and 8–9 if unblocked) are live and verified with real test data:

- [x] Remove `generatePR2FromRfq()`'s services-reachable path (`lib/pr2.ts:227`) — once Phase 2 ships, no new Services PR2 should ever be created this way. Keep the function if Raw Material or another caller still needs it (check before deleting); otherwise remove entirely and delete its only call site (`app/rfq/[id]/page.tsx:510`).
- [x] Remove the now-dead `for_canvassing`/`canvassing_complete` code paths for `services` left in place from Phase 2 (the block at `lib/warehouse.ts:601-604, 676-689`).
- [x] Update `docs/audit-deliverables/H-Status-Workflow-Matrix.md` §2 ("Services / legacy PR1→RFQ→PR2" diagram) to reflect the corrected flow, mirroring how that doc already documents the corrected Goods flow.
- [x] Sweep for any remaining `services`-only carve-outs missed by this plan (grep `request_type.*services` across `lib/` and `app/` once more) before declaring Services fully aligned.

---

## Verification checklist (run after each bundle)

1. `npx tsc --noEmit` after each phase's file changes.
2. Confirm no Goods or Raw Material regression: re-run the existing manual test flows for both (submit PR1/PR2 → approval → RFQ → PO → send → delivery → GRN) since several phases touch shared functions via broadened conditionals.
3. Live end-to-end test with a real Services PR1 (End User entry) and a real Services PR2 (Planning-direct entry) through every bundle in order, using Supabase MCP to spot-check status transitions at each stage the same way this audit did.
