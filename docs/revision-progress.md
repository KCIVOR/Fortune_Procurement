# Revision Progress Tracker

Revisions from [revisions.md](revisions.md), ordered easiest → hardest. Check items off as they're completed.

| Order | Rev # | Revision | Status |
|-------|-------|----------|--------|
| 1 | 5 | Substitute accept/reject by procurement | ✅ Done |
| 2 | 2 | PR assignment to buyer | ✅ Done |
| 3 | 6 | RFQ reopen once closed | ✅ Done |
| 4 | 8 | GRN for services (procurement-handled) | ✅ Done |
| 5 | 7 | GRN reopen and edit once closed | ✅ Done |
| 6 | 3 | Accreditation expiry per document + notifications | ✅ Done (manual entry only — notifications not started) |
| 7 | 9 | Priority level — visibility, permission, filtering | ✅ Done |
| 8 | 1 | VAT handling (VAT-able flag + VAT-IN/VAT-EX) | ✅ Done |
| 9 | 4 | TSQA / RSE product review redesign | 🚫 Blocked — requirements TBC |
| 10 | 10 | Remarks on PR1 request creation | ⬜ Not started — audit pending |
| 11 | 11 | Supplier product registration by procurement | ⬜ Not started — audit pending |
| 12 | 12 | Warehouse change request quantity | ⬜ Not started — audit pending |

**Status legend:** ⬜ Not started · 🔄 In progress · ✅ Done · 🚫 Blocked

---

## 1. Substitute Item — Procurement Accept/Reject on Behalf of Employee (Rev #5)

- [x] Add accept/reject action for procurement on the substitute review page
- [x] Allow procurement to act on behalf of the requestor (mutual override with requestor)
- [x] Notify requestor when procurement decides on their behalf
- [x] Log actor role + on-behalf flag in audit trail

**Why easiest:** Accept/reject logic already exists for the requestor — mostly extending permission and UI on the same page.

**Shipped:**
- DB: [supabase/migrations/20260706120000_substitute_decisions_procurement_override.sql](supabase/migrations/20260706120000_substitute_decisions_procurement_override.sql) — RLS policies for procurement insert/update + mutual override
- Access: [config/route-access.ts](config/route-access.ts), [config/navigation.ts](config/navigation.ts) — `/substitutes` opened to procurement
- Data: [lib/canvassing.ts](lib/canvassing.ts) — new `fetchSubstituteReviewBundles()` (RLS-scoped, replaces per-role N+1 loop), `decided_by_role` attribution, actor-aware notification in `saveSubstituteDecision`
- Types: [types/canvassing.ts](types/canvassing.ts) — `decided_by_role`, `requisitioner_name_snapshot`
- UI: [app/substitutes/page.tsx](app/substitutes/page.tsx), [app/substitutes/[pr1Id]/page.tsx](app/substitutes/[pr1Id]/page.tsx) — Requestor column for procurement, on-behalf badge/hint, procurement decision UI
- Verified: `tsc --noEmit` clean, RLS policies confirmed live in Supabase, dev server boots without errors. Manual browser walkthrough not performed (declined) — recommend a manual smoke test before considering this fully closed.

---

## 2. PR Assignment to Buyer (Rev #2)

- [x] Add assign button/dropdown of procurement staff on the canvassing/RFQ page
- [x] Purely informational (no authorization gating) — notifies assignee on (re)assignment
- [x] Add "Assigned to Me" / "Unassigned" filter on `/rfq`

**Complexity:** Small, self-contained — new assignment field + dropdown + dashboard visibility.

**Shipped:**
- DB: [supabase/migrations/20260706130000_pr1_assigned_buyer.sql](supabase/migrations/20260706130000_pr1_assigned_buyer.sql) — `assigned_buyer_id`, `assigned_buyer_name_snapshot`, `assigned_at`, `assigned_by` on `pr1_requests` + index. No RLS changes needed (procurement already had unrestricted UPDATE; `/rfq` already procurement-only).
- Types: [types/canvassing.ts](types/canvassing.ts) — `CanvassingQueueRow` extended
- Data: [lib/canvassing.ts](lib/canvassing.ts) — `listProcurementUsers()`, `assignPr1ToBuyer()` (mirrors the existing `assignRSEToTSQA` pattern), `assignedFilter` param on `fetchCanvassingQueuePaged`
- UI: [app/rfq/page.tsx](app/rfq/page.tsx) — "Assigned To" column + assign modal, "Assigned"/"Assigned to Me"/"Unassigned" filter
- Verified: `tsc --noEmit` clean, dev server boots without errors. Manual browser walkthrough not performed (no test credentials) — recommend a manual smoke test.

---

## 3. RFQ — Reopen Once Closed (Rev #6)

- [x] Add reopen action on closed RFQs
- [x] Allow supplier price updates and other modifications after reopening
- [x] Guard against reopening RFQs that already produced a PR2/PO — blocked entirely, no override

**Complexity:** Status transition + button; main care point is downstream PO state.

**Shipped:**
- No DB migration needed — procurement already had unrestricted UPDATE on `rfq_batches`/`pr1_requests` (confirmed in audit).
- Data: [lib/canvassing.ts](lib/canvassing.ts) — `reopenRfq()`: guards on RFQ status + existing PR2, reverts `pr1_requests.status` to `for_canvassing`, logs `RFQ_REOPENED` to `audit_logs`, notifies procurement + requestor.
- UI: [app/rfq/[id]/page.tsx](app/rfq/[id]/page.tsx) — "Reopen RFQ" button (amber `ActionButton` variant added) shown only when closed with no PR2 yet; explanatory note shown once a PR2 exists.
- Verified: `tsc --noEmit` clean, dev server boots without errors. Manual browser walkthrough not performed (no test credentials) — recommend a manual smoke test, especially the guard against reopening RFQs with an existing PR2 (11 live POs already exist downstream in this dataset).

---

## 4. GRN for Services — Handled by Procurement (Rev #8)

- [x] Allow procurement to open/edit/close the GRN for service-type transactions
- [x] Warehouse restricted to goods-type GRNs only (no access to services, per client decision)
- [x] Fixed `closeGRN`'s hardcoded `actor_role: 'warehouse'` to use the real actor's role

**Complexity:** Conditional branch in an existing flow based on PR type.

**Shipped:**
- DB: [supabase/migrations/20260706140000_grn_services_procurement.sql](supabase/migrations/20260706140000_grn_services_procurement.sql) — `request_type_for_delivery()`/`request_type_for_grn()` helper functions + full RLS split: warehouse ↔ goods only, procurement ↔ services only, on both `grn_receipts` and `grn_items`.
- Code: [lib/grn.ts](lib/grn.ts) — `closeGRN` now logs the real `profile.role` instead of a hardcoded `'warehouse'`.
- UI: [app/delivery/[id]/page.tsx](app/delivery/[id]/page.tsx) — "Receive Goods (GRN)" button now gated by `request_type` (procurement for services, warehouse for goods). [app/grn/[id]/page.tsx](app/grn/[id]/page.tsx) — edit/close capability gated the same way.
- Queue page ([app/grn/page.tsx](app/grn/page.tsx)) needed no code change — RLS automatically scopes the list per role.
- **Correction (2026-07-06):** the initial ship restricted procurement's SELECT to services-only, which broke traceability — the "Related Records" panel showed "Not yet created" for goods GRNs warehouse had already closed (caught by user testing on PO-2026-0018 / GRN-2026-0023). Fixed via [supabase/migrations/20260706150000_grn_procurement_read_all_fix.sql](supabase/migrations/20260706150000_grn_procurement_read_all_fix.sql): procurement's SELECT is restored to unrestricted (all GRNs, any type) for oversight/tracing; INSERT/UPDATE remain services-only as intended. Warehouse's goods-only scoping is unaffected.
- Verified: `tsc --noEmit` clean, dev server boots without errors, `request_type_for_grn()` confirmed against live data (mix of goods/services GRNs resolves correctly), read-access regression confirmed fixed against the exact GRN (GRN-2026-0023, goods, closed) reported by user testing.

---

## 5. GRN — Reopen and Edit Once Closed (Rev #7)

- [x] Add reopen action on closed GRNs — allowed anytime (audit confirmed nothing is generated from a GRN; all closed-state consumers are derived at read time and self-correct)
- [x] Support both warehouse (goods) and procurement (services) GRNs, matching Rev #8's type/role split
- [x] Keep `closed_at`/`received_by_*` as a visible trace while reopened; re-closing overwrites them
- [x] Notify requestor on reopen; `GRN_REOPENED` audit log + delivery history entry

**Complexity:** Like RFQ reopen but riskier — closed GRNs may already feed quantities and reports. (Audit showed the risk was smaller than assumed: no inventory ledger exists; lifecycle chips/badges/tab counts all recompute live.)

**Shipped:**
- No DB migration needed — the `status CHECK ('open','closed')` allows the transition, and the Rev #8 RLS UPDATE policies have no status restriction.
- Data: [lib/grn.ts](lib/grn.ts) — `reopenGRN()`: guards (must be closed; RLS 0-row update surfaced as friendly permission error), reverts status to `open`, delivery history entry, `GRN_REOPENED` audit log, requestor notification.
- UI: [app/grn/[id]/page.tsx](app/grn/[id]/page.tsx) — amber "Reopen GRN" button (closed + `canHandle` only), "previously closed on … by …" trace note while reopened, error banner for reopen failures on the closed view.
- Verified: `tsc --noEmit` clean. Manual browser walkthrough by user pending — test the full cycle: close → reopen → edit quantities → re-close, on both a goods GRN (warehouse) and services GRN (procurement); confirm requestor notifications and the PR1 lifecycle chip regressing/restoring.

---

## 6. Accreditation Expiry per Document (Rev #3)

- [x] Add manual expiry date field on the accreditation approval page — fully replaces the old global auto-calculation
- [x] Same manual entry extended to product/service verification (per confirmed decision, symmetric with accreditation)
- [ ] Email/system notification when expiry is approaching (scheduled job) — **deferred, not started this pass**
- [ ] Auto-scan of uploaded documents for validity dates — **under evaluation, TBC** (also confirmed out of scope: per-accreditation only, not per individual document)

**Complexity:** Manual field is easy; notifications need scheduling infrastructure.

**Shipped (manual entry only):**
- No DB/RLS changes — `supplier_accreditations.valid_until` / `supplier_products.valid_until` already existed from a prior initiative (global auto-calc + live `pg_cron` nightly expiry job, confirmed still active and untouched).
- Data: [lib/accreditation.ts](lib/accreditation.ts) `approveAccreditation()` and [lib/supplier-products.ts](lib/supplier-products.ts) `markProductVerified()` — both now take an optional `validUntil` param from the caller instead of computing it from `system_expiry_settings`; validates future-date-or-null before writing; audit log payload includes the chosen value.
- UI: [app/accreditation/[id]/page.tsx](app/accreditation/[id]/page.tsx) and [app/accreditation/products/[id]/page.tsx](app/accreditation/products/[id]/page.tsx) — approve/verify panels gained an optional date input with inline future-date validation, alongside the existing notes field.
- Verified: `tsc --noEmit` clean. Manual browser walkthrough not performed (no test credentials) — recommend testing: approve with a future date, approve with blank (confirm `valid_until` is null, no expiry banners), and approve with a past date (confirm inline error, no write).
- **Cleanup (2026-07-07):** audited and confirmed `system_expiry_settings` was fully orphaned (write-only — no approval flow or the nightly `pg_cron` expiry job read it), so it was removed entirely: dropped the table ([supabase/migrations/20260707130000_drop_system_expiry_settings.sql](supabase/migrations/20260707130000_drop_system_expiry_settings.sql)), deleted [lib/system-settings.ts](lib/system-settings.ts), removed the `ExpirySettingsCard` from [app/admin/settings/page.tsx](app/admin/settings/page.tsx), and removed the `SystemExpirySettings` type from [types/database.ts](types/database.ts). `valid_until` columns, status constraints/indexes, and the cron job itself are untouched — this only removed the dead config table.
- **Follow-up (2026-07-06):** added a direct "Edit Expiry" action on already-approved accreditations (`updateAccreditationExpiry()` in [lib/accreditation.ts](lib/accreditation.ts)) so procurement doesn't have to Reopen→Approve just to fix or extend a date. Scoped to `status = 'approved'` only — deliberately excludes `expired` records, which still require the full Reopen for Review → Approve cycle so un-expiring something is always a reviewed action, not a quiet date edit. Logs `ACCREDITATION_EXPIRY_UPDATED` to `audit_logs` with old/new values.
- **Extended to product verification (2026-07-06):** identical treatment mirrored onto product/service verification per user request — `updateProductVerificationExpiry()` in [lib/supplier-products.ts](lib/supplier-products.ts), same "Edit Expiry" panel in [app/accreditation/products/[id]/page.tsx](app/accreditation/products/[id]/page.tsx), scoped to `status = 'verified'` only (excludes `expired`/`inactive`), logs `SUPPLIER_PRODUCT_EXPIRY_UPDATED`.

---

## 7. Priority Level — Visibility, Permission, and Filtering (Rev #9)

- [x] Requestor can update priority on own PR1 at any status; also opened to approver/procurement (any position)
- [x] Priority column added to all in-scope list pages
- [x] Priority filter added to all in-scope list pages
- [x] Notify assigned buyer (or procurement role) on priority change

**Complexity:** Each change is trivial but the surface area is wide — nearly every list view in the app.

**Shipped:**
- No DB migration needed — "Owners can update own PR1s" RLS policy already granted unrestricted write; only the app-code gate (`canUpdatePR1Priority`) needed widening.
- Data: [lib/pr1.ts](lib/pr1.ts) (`canUpdatePR1Priority`, `updatePR1Priority` + notification), [lib/pr2.ts](lib/pr2.ts), [lib/po.ts](lib/po.ts), [lib/delivery.ts](lib/delivery.ts), [lib/grn.ts](lib/grn.ts), [lib/canvassing.ts](lib/canvassing.ts) — all priority joins are ID-based (never `pr1_number`/`po_number` text, per the duplicate-PR1 lesson).
- Types: `pr1_priority`/`priority` fields added to [types/pr2.ts](types/pr2.ts), [types/po.ts](types/po.ts), [types/delivery.ts](types/delivery.ts), [types/grn.ts](types/grn.ts), [types/canvassing.ts](types/canvassing.ts).
- UI: column + filter added to `/pr1`, `/rfq`, `/pr2`, `/po`, `/delivery`, `/grn`, `/substitutes`, `/approvals/pr1`, `/approvals/pr2`, `/approvals/po` (last 4 already had the column; only filters were added there). `/warehouse` was the pre-existing reference pattern, left untouched. `/approvals` combined queue and `/approvals/history` excluded per confirmed scope.
- Verified: `tsc --noEmit` clean across the whole change set. Manual browser walkthrough not performed (no test credentials) — recommend testing the requestor's own-PR1 edit permission, the notification on change, and each new filter dropdown.
- **Follow-up fixes (2026-07-06, from user testing):**
  - `/rfq` had Priority/Type badges crammed into the "PR1 No." cell with no column headers — split into dedicated "Type" and "Priority" columns.
  - Priority editing was only reachable from `/pr1/[id]` and `/approvals/[id]` (the PR1 approval action page). Extended the editor (new shared [components/shared/PrioritySelector.tsx](components/shared/PrioritySelector.tsx)) to `/pr2/[id]`, `/po/[id]`, `/approvals/pr2/[id]`, and `/approvals/po/[id]` — the pages procurement/approvers actually spend time on. Each resolves `pr1_id` via the existing ID-based join chain and calls the same `updatePR1Priority`.

---

## 8. VAT Handling (Rev #1)

- [x] Add VAT-able / Non-VAT flag on supplier profile (admin/procurement configurable, defaults to non-VAT)
- [x] Add VAT-IN / VAT-EX indicator on quotation submission — supplier portal and procurement's external-vendor manual entry
- [x] PR2/PO snapshot the winning quote's VAT type + system VAT rate at generation time (never re-looked-up live)
- [x] Verify VAT math (Subtotal / VAT / Total breakdown) everywhere totals are computed/displayed

**Complexity:** Touches supplier profile, quotation form, and PO computation — pricing bugs have financial impact.

**Decisions confirmed with client:**
- VAT rate is a single admin-configurable system setting (seeded 12%), not per-supplier.
- VAT-Inclusive quoted price is used as-is (never recomputed); only the Subtotal/VAT split is derived for display.
- Non-VAT-registered suppliers show no VAT-IN/EX toggle at all (hidden, not disabled).
- Breakdown format everywhere: Subtotal / VAT / Total.
- Rate + type are snapshotted onto `pr2_items`/`po_items` at generation time so historical breakdowns stay stable if the admin rate changes later.

**Shipped:**
- DB: [supabase/migrations/20260707120000_vat_handling_schema.sql](supabase/migrations/20260707120000_vat_handling_schema.sql) — `system_vat_settings` (single-row config, seeded 12%), `profiles.is_vat_registered`, `vat_type`/`vat_rate_applied` on `rfq_item_quotes`/`pr2_items`/`po_items`. [supabase/migrations/20260707120100_vat_handling_rls.sql](supabase/migrations/20260707120100_vat_handling_rls.sql) — RLS on `system_vat_settings` (all authenticated read, admin-only update).
- Core lib: [lib/vat.ts](lib/vat.ts) — `getVatSettings`/`updateVatSettings`, `computeLineVat()` (the VAT-IN/EX/non-VAT math), `aggregateVat()`.
- Supplier VAT-registration toggle: [app/api/admin/users/[id]/vat-status/route.ts](app/api/admin/users/[id]/vat-status/route.ts) (service-role write, mirrors the existing payment-terms route), [components/admin/SupplierVatStatusForm.tsx](components/admin/SupplierVatStatusForm.tsx), wired into [components/procurement/SupplierAccountDetail.tsx](components/procurement/SupplierAccountDetail.tsx); `is_vat_registered` added to [lib/procurement-suppliers.ts](lib/procurement-suppliers.ts).
- Quotation entry: [app/supplier/quotations/[rfqSupplierId]/page.tsx](app/supplier/quotations/[rfqSupplierId]/page.tsx) (supplier's own form) and [app/rfq/[id]/page.tsx](app/rfq/[id]/page.tsx) (procurement's external-vendor manual entry) — VAT-IN/EX toggle shown only when the supplier is VAT-registered, with a live Subtotal/VAT/Total preview.
- PR2 generation: [lib/pr2.ts](lib/pr2.ts) `generatePR2FromRfq()` snapshots `vat_type`/`vat_rate_applied` per line from the winning quote + supplier's registration status; `savePR2Items()` recomputes `total_price` via `computeLineVat` on qty edits (never loses the snapshot); added `calcPR2VatBreakdown()`.
- PO generation: [lib/po.ts](lib/po.ts) carries the PR2 line's VAT snapshot onto `po_items`; added `calcPOVatBreakdown()`.
- Display (Subtotal/VAT/Total, gated by `canViewCommercialPricing`): [app/pr2/[id]/page.tsx](app/pr2/[id]/page.tsx), [app/approvals/pr2/[id]/page.tsx](app/approvals/pr2/[id]/page.tsx), [app/po/[id]/page.tsx](app/po/[id]/page.tsx), [app/approvals/po/[id]/page.tsx](app/approvals/po/[id]/page.tsx), [app/supplier/po/[id]/page.tsx](app/supplier/po/[id]/page.tsx), [app/po/[id]/print/page.tsx](app/po/[id]/print/page.tsx). RFQ comparison matrix ([lib/canvassing.ts](lib/canvassing.ts) `buildQuoteMatrix()`) also made VAT-aware — per-quote `total_price` now reflects the supplier's registration + chosen VAT type instead of plain `unit_price × qty`.
- Admin: [app/admin/settings/page.tsx](app/admin/settings/page.tsx) — new "VAT Rate" card (mirrors the Expiry Settings layout) wired to `getVatSettings()`/`updateVatSettings()`.
- Verified: `tsc --noEmit` clean after every phase and on the full final change set. Manual browser walkthrough not performed (no test credentials) — recommend testing: toggling a supplier's VAT registration, submitting a VAT-IN vs VAT-EX quote (both supplier portal and external-vendor manual entry), generating a PR2/PO from a mixed VAT/non-VAT award, editing PR2 quantity post-generation (confirm total recomputes with VAT intact), and the Subtotal/VAT/Total breakdown on PR2/PO detail, approvals, supplier PO view, and the PO print view.

---

## 9. Product Review Module — TSQA Route (Rev #4)

- [ ] Confirm exact TSQA / RSE (Request for Sample Evaluation) route with procurement team
- [ ] Redesign module to match Fortune's actual QA-handled process
- [ ] Implement redesigned flow

**Status:** 🚫 Blocked — needs requirements confirmation before any implementation.

---

## 10. Remarks on PR1 Request Creation (Rev #10)

- [ ] Add optional remarks/notes field to the PR1 creation form
- [ ] Persist remarks on the request and surface to approvers/procurement downstream
- [ ] Audit whether a `remarks`/`notes` column already exists on `pr1_requests`

**Complexity:** Likely small — a single field on the create form + a column, mirroring existing free-text fields.

**Status:** ⬜ Not started — awaiting audit (audit → confirm → plan → proceed).

---

## 11. Supplier Product Registration — Handled by Procurement (Rev #11)

- [ ] Audit what recent catalog-ownership work already delivered (supplier write access to `supplier_products` was removed; catalog ownership moved)
- [ ] Confirm procurement can create/register a supplier's product on their behalf
- [ ] Confirm supplier-side product creation is fully removed from the UI/RLS
- [ ] Identify remaining gaps vs. the client requirement

**Complexity:** Possibly mostly done already via recent commits — audit to determine what's left.

**Status:** ⬜ Not started — awaiting audit.

---

## 12. Warehouse — Change Request Quantity (Rev #12)

- [ ] Confirm scope: which quantity and which document in the chain warehouse should be able to edit (request qty on PR1, GRN receiving qty, etc.)
- [ ] Add edit-quantity capability for warehouse (UI + RLS/permission)
- [ ] Determine downstream recomputation impact (totals, PR2/PO, GRN) and self-correcting reads
- [ ] Audit trail + notification on quantity change

**Complexity:** Medium — permission + which-quantity scope + downstream ripple; needs a confirmed scope before planning.

**Status:** ⬜ Not started — awaiting audit and scope confirmation.
