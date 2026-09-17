# Audit Logging Gaps — Fix Plan

## Context

A prior audit (this session) found that several user-triggered actions across
the Fortune Procurement system write no `audit_logs` row at all, and a larger
set of existing audit inserts are wrapped in a silently-swallowing
`try/catch`, so a transient DB hiccup can leave a real action (approve,
delete, upload, create) with zero trace. The goal here is to close the real
gaps and add visibility into the silent-catch failures, **without** changing
any business logic, control flow, or existing call-site behavior beyond what
is strictly needed to attach an actor id to a log entry.

This codebase already has a documented, previously-executed plan for a
similar pass (`docs/audit-logging-gap-implementation-plan.md`) — it fixed an
earlier round of gaps (PR1 drafts/attachments, GRN open/save, RFQ supplier
assignment) and established the house conventions this plan reuses exactly:

- **Best-effort logging**: every `audit_logs` insert is wrapped in
  `try/catch` (or `.catch(() => {})`) so a log failure never blocks the real
  operation. This plan does not change that principle — Phase 4 only adds a
  `console.error` inside existing catches, it does not add new try/catch
  around currently-unwrapped inserts or change any control flow.
- **Minimum signature change**: only add a new parameter when the function
  has genuinely no actor info available internally (no `profile` param and no
  `requireAuthUserId()` already in scope). Every call site of a changed
  signature is updated in the same phase.
- Row shape: `{ actor_id, action: 'SCREAMING_SNAKE_CASE', document_type, document_id, payload }`.

I verified every item below by reading the actual function body and its real
call sites (not just grepping for the string `audit_logs`) — two items from
the initial automated audit turned out to be **false positives** and are
explicitly excluded (see "Excluded" section).

**Schema validation pass (2026-09):** every table/column name and every
`document_type` value in this plan was checked against the live Supabase
schema (`information_schema.columns`, `pg_constraint`, and the actual
distinct `document_type` values already present in `audit_logs`). Result:
`audit_logs.action`/`document_type` have no CHECK constraint or enum (both
plain `text`), so any new value is accepted — but one drafted value did not
match the established convention and was corrected: Phase 2's document
upload entry now uses `document_type: 'ACCREDITATION_DOCUMENT'` (matching
the 5 other actions already in `lib/accreditation-documents.ts`, e.g.
`ACCREDITATION_DOCUMENT_VERIFIED`) instead of the originally-drafted
`'SUPPLIER_DOCUMENT'`, which would have introduced an inconsistent new
category. Every other document_type used below (`PROFILE`, `PR1`, `PR2`,
`PO`, `RFQ`, `RFQ_QUOTE`, `GRN`, `ACCREDITATION`, `DEPARTMENT`, `POSITION`)
matches an existing, already-used value; `SETTINGS` (Phase 1, SMTP) and
`SUPPLIER_PRODUCT` (Phase 1, product create) are legitimately new categories
with no existing precedent to conflict with. Every column referenced (e.g.
`po_requests.po_date/delivery_address/warehouse/payment_terms/packing/remarks`,
`supplier_products.product_code`, `supplier_documents.uploaded_by`,
`warehouse_validations.pr1_id`, `pr2_requests.purpose/date_required/priority/remarks`)
was confirmed to exist exactly as named. Every function slated for a
signature change (`removeExternalVendorFromRfq`, `forwardItemToQA`) was
re-grepped across the **entire** repo (not just `app/`/`lib/`) and confirmed
to have exactly the one call site already listed below — no other caller
will be affected.

---

## Guardrails (apply to every phase)

1. **No behavior change to business logic.** Only add code; never reorder or
   remove an existing status-transition, validation, or DB write.
2. **No signature change unless listed below**, and every changed signature
   lists its exact call site(s) to update in the same edit.
3. **`updatePODraft` (`lib/po.ts`) keeps its exact signature and call site**
   — this is an explicit constraint from `docs/superpowers/plans/2026-08-04-po-revision-requested-save.md:31`
   ("Do not refactor `updatePODraft` callers or rename the function"). The
   actor id is resolved internally via `requireAuthUserId()` instead.
4. **Best-effort stays best-effort.** New inserts follow the same
   try/catch-or-`.catch()` pattern as their neighbors in the same file; none
   of them are allowed to throw and block the real action.
5. **No payload ever contains a raw secret.** The SMTP settings audit entry
   (Phase 1) logs metadata only (host/port/username/from address/whether the
   password changed) — never the password itself.
6. Run `npx tsc --noEmit` and `npx eslint <changed files>` after every phase
   before moving to the next. Phases are independently revertable.

---

## Excluded (verified false positives / explicitly out of scope)

- **`createDepartment` / `updateDepartment` / `createPosition` / `updatePosition`**
  (`lib/admin-masterdata.ts`) — the initial automated audit flagged these as
  unlogged. Verified false: `app/admin/departments/page.tsx:81,123` and
  `app/admin/positions/page.tsx:92,136` call `logDepartmentAudit`/
  `logPositionAudit` right after each of these succeeds. Already covered.
  **No change.**
- **`lib/po-approvals.ts:488` (`submitPOApprovalAction`)** — the audit insert
  fires without checking whether the preceding `approval_instances`/
  `po_requests` `.update()` calls succeeded. On inspection, **none** of the
  status-transition updates in this function check `{ error }` today (not
  just the one before the audit insert) — this is a pre-existing
  error-handling gap in the approval flow itself, not specifically an
  audit-logging gap, and fixing it means touching PO approval control flow.
  Flagging it separately rather than bundling a control-flow change into an
  "add audit logs" pass. **No change in this plan.**

---

## Phase 0 — Trivial conditional-gate removal (lowest risk)

**Files:** `lib/admin-masterdata.ts`
**Signature change:** none. **Call sites:** none affected.

`deactivateDepartment`, `reactivateDepartment`, `deactivatePosition`,
`reactivateDepartment` all gate their existing `logDepartmentAudit`/
`logPositionAudit` call behind `if (adminId) { ... }`. Every real call site
(`app/admin/departments/page.tsx:162,186`, `app/admin/positions/page.tsx:185,211`)
already passes a real `profile.id`, so the gate never actually fires today —
it only exists because the parameter type is `adminId: string | null`. Since
`logDepartmentAudit`/`logPositionAudit` already accept `actorId: string | null`
directly, just remove the `if (adminId)` wrapper in all four functions and
call the logger unconditionally. Zero behavior change for any real caller;
closes the theoretical gap for good.

---

## Phase 1 — New audit inserts in API routes (additive only)

Each of the 4 routes below already has the acting user's id and the changed
entity's id in scope; add one `audit_logs` insert immediately before the
existing success `return NextResponse.json(...)`, matching the exact shape
used by sibling routes (`app/api/admin/users/[id]/status/route.ts:186-198`,
`app/api/procurement/suppliers/create/route.ts:135-147`): unconditional
insert, `if (auditErr) console.error(...)` on failure, never thrown.

| Route | Actor var | document_id | New action |
|---|---|---|---|
| `app/api/admin/users/create/route.ts` (insert after line 137, before line 139) | `user.id` | `userId` | `USER_CREATED` |
| `app/api/admin/users/invite/route.ts` (insert after line 161, before line 163) | `user.id` | `invitedId` | `USER_INVITED` |
| `app/api/admin/smtp-settings/route.ts` `PUT` (insert after line 86, before line 89) | `auth.userId` | `null` (see note) | `SMTP_SETTINGS_UPDATED` |
| `app/api/procurement/products/create/route.ts` (insert after line 146, before line 148) | `auth.userId` | `product.id` | `SUPPLIER_PRODUCT_CREATED` |

`document_type`: `'PROFILE'` for the two user routes, `'SETTINGS'` for SMTP,
`'SUPPLIER_PRODUCT'` for the product route.

Payload contents:
- `USER_CREATED`: `{ target_user_id: userId, target_user_email: email, target_user_name: full_name, role_id, department_id, position_id }`
- `USER_INVITED`: `{ target_user_id: invitedId, target_user_email: normalizedEmail, target_user_name: full_name, role_id, department_id, position_id }`
- `SMTP_SETTINGS_UPDATED`: `{ host, port, from_email: fromEmail, from_name: fromName, username, password_changed: Boolean(incomingPassword) }` — **no password value**. Note: `document_id` is `null`, not the literal string `'smtp_settings'` as first drafted — `audit_logs.document_id` is a `uuid` column and the settings row is a singleton with no meaningful id to reference, so `null` (already nullable) is correct; a non-UUID string would fail the insert.
- `SUPPLIER_PRODUCT_CREATED`: `{ supplier_id: supplierId, product_name: productName, product_code: product.product_code, item_type: 'goods' }`

---

## Phase 2 — Accreditation gaps (additive + one rename)

**File:** `lib/accreditation.ts` — all three functions already receive
`profile: UserProfile`, no signature change.

- `createDraftAccreditation` (lines 62-98): add insert right after the
  successful `.select('*').single()`, action `ACCREDITATION_DRAFT_CREATED`,
  `document_type: 'ACCREDITATION'`, `document_id: data.id`, payload
  `{ supplier: profile.full_name }`. Wrap in the same try/catch style as
  `revokeAccreditation` in the same file.
- `markAccreditationUnderReview` (lines 310-330): add insert right after the
  `updated.length` check passes, action `ACCREDITATION_UNDER_REVIEW`,
  `document_id: accreditationId`, payload `{ reviewer: profile.full_name }`.
- `revokeAccreditation` (line 640): rename the `action` value from
  `'ACCREDITATION_EXPIRED'` to `'ACCREDITATION_REVOKED'`. Verified safe —
  grepped the whole repo, this string is read nowhere else; the separate
  nightly cron expiry job (`supabase/migrations/20260624020929_expiry_cron_job.sql`)
  is a raw SQL `UPDATE` that never touches `audit_logs`, so there is no
  actual collision today. This is a pure one-token value change.

**File:** `lib/accreditation-documents.ts` — the shared internal helper
`uploadAndRecord` (lines 80-114) already receives `docFields.uploaded_by`
(= `profile.id` from both call sites), so no new parameter is needed. Add
one insert right after the successful document insert, action
`ACCREDITATION_DOCUMENT_UPLOADED`, `document_type: 'ACCREDITATION_DOCUMENT'`
(verified against the DB — this file's other 5 actions, e.g.
`ACCREDITATION_DOCUMENT_VERIFIED` at line 313, all already use this exact
`document_type`; the originally-drafted `'SUPPLIER_DOCUMENT'` would have been
a new, inconsistent value with zero other rows using it), `document_id:
docRow.id`, payload
`{ file_name: file.name, document_type: docFields.document_type, accreditation_id: docFields.accreditation_id, supplier_product_id: docFields.supplier_product_id }`.
Covers both `uploadSupplierAccreditationDocument` and
`uploadSupplierProductDocument` in one place.

---

## Phase 3 — Workflow library gaps (mix of additive + 2 signature changes)

### 3-A `updateRawMaterialPR2Draft` — `lib/pr2-planning.ts:610-647`
No signature change (`profile` already a param). Add insert after the item
sync completes (before `return { items: syncedItems }`), action
`PR2_RAW_MATERIAL_DRAFT_UPDATED`, `document_type: 'PR2'`,
`document_id: pr2Id`, payload
`{ updated_by: profile.full_name, header_changed: Object.keys(patch).length > 1, item_count: input.items?.length ?? null }`.

### 3-B `updatePODraft` — `lib/po.ts:863-878`
**Signature and call site (`app/po/[id]/page.tsx:166`) stay exactly as-is**
per the documented constraint. Import `requireAuthUserId` from
`@/lib/auth-session` (already used identically in `lib/pr1.ts`,
`lib/pr2-planning.ts`, `lib/warehouse.ts`) and call it inside the function to
get the actor id. Add insert after the existing success check, action
`PO_DRAFT_UPDATED`, `document_type: 'PO'`, `document_id: poId`, payload
`{ ...values }` (the fields being edited — no secrets involved here).

### 3-C `removeExternalVendorFromRfq` — `lib/canvassing.ts:1746-1777`
**Signature change**, following the exact precedent already used for
`assignSuppliers`/`addExternalVendorToRfq` in this same file (see
`docs/audit-logging-gap-implementation-plan.md` Phase 1): add
`profile: UserProfile` as a new last parameter. One call site to update:
`app/rfq/[id]/page.tsx:439` (`profile` already in scope in that component,
confirmed at line 77). Add insert after the delete succeeds, action
`RFQ_EXTERNAL_VENDOR_REMOVED`, `document_type: 'RFQ'`, payload
`{ removed_by: profile.full_name, vendor_slot_id: rfqSupplierId }`. Note:
the RFQ's own id isn't fetched in this function — use `document_id: rfqSupplierId`
with `document_type: 'RFQ_QUOTE'` to match the file's existing convention for
vendor-slot-level events (same convention already used for
`RFQ_QUOTE_ATTACHMENT_*` actions in this file) rather than adding an extra
query just to fetch the parent RFQ id.

### 3-D `submitSupplierQuotation` — `lib/canvassing.ts:3490-3767`
No signature change. Import `requireAuthUserId` (not yet imported in this
file) and call it once the core writes succeed. Insert point: right after
`if (statusErr) throw statusErr;` (line 3627) and **before** the best-effort
notification `try` block (line 3633) — this is the actual transactional
boundary of the supplier's quote submission. Action
`RFQ_QUOTATION_SUBMITTED`, `document_type: 'RFQ_QUOTE'`,
`document_id: rfqSupplierId`, payload
`{ item_count: quotes.length, alternative_count: alternativeCount }`.

### 3-E `forwardItemToQA` — `lib/grn.ts:74-88`
**Signature change**: add `profile: UserProfile` as a new third parameter,
matching the pattern already used by every other GRN lifecycle function in
this file. One call site to update: `app/grn/[id]/page.tsx:62` (`profile`
already in scope, confirmed at line 31; that page already guards other GRN
calls with `if (!grn || !profile) return;`, so mirror that guard here too).
Insert after `evaluateGRNQAStatus(grnId)` succeeds, action
`GRN_ITEM_FORWARDED_TO_QA`, `document_type: 'GRN'`, `document_id: grnId`,
payload `{ item_id: itemId, forwarded_by: profile.full_name }`.

### 3-F `openValidation` — `lib/warehouse.ts:248-321`
No signature change (`profile` already a param). Add insert right before
each `return` that hands back a freshly-created validation (skip the early
`if (existing) return existing;` — that's not a "new" action). Action
`WAREHOUSE_VALIDATION_OPENED`, `document_type: 'PR1'`, `document_id: pr1Id`,
payload `{ validation_id: created.id, opened_by: profile.full_name }`.

### 3-G `saveValidationProgress` — `lib/warehouse.ts:344-401`
No signature change (`profile` already a param). The header `.update()` at
line 349-355 doesn't currently select `pr1_id`; extend its existing
`.update(...).eq('id', validationId)` with `.select('pr1_id').maybeSingle()`
(one extra field on a query that's already running — no new round trip) and
use the returned `pr1_id` for the audit entry. Insert at the end of the
function, action `WAREHOUSE_VALIDATION_PROGRESS_SAVED`,
`document_type: 'PR1'`, `document_id: pr1Id`, payload
`{ validation_id: validationId, item_count: values.items.length }`.

---

## Phase 4 — Silent-catch visibility (console.error only, no behavior change)

Add `console.error('[<context>] audit log failed:', err)` inside each
currently-silent `catch { }` / `catch {}` / `.catch(() => {})` wrapping an
`audit_logs` insert. This does **not** add try/catch anywhere new and does
**not** change whether the real action succeeds — purely makes a previously
invisible failure show up in server logs. Representative sites (same pattern
repeated — no need to enumerate every one during implementation, just apply
the same one-line addition wherever this exact pattern appears within the
files already touched by Phases 2-3, plus these pre-existing ones not
otherwise touched this pass):

- `lib/canvassing.ts` — `assignSuppliers`, `addExternalVendorToRfq`,
  buyer assign/unassign (x4), `uploadRfqQuoteAttachment`,
  `deleteRfqQuoteAttachment`
- `lib/grn.ts` — `openGRNForDelivery`, `saveGRNProgress`, `closeGRN`, `reopenGRN`
- `lib/grn-tsqa.ts` — `approveGRNItemQA`, `rejectGRNItemQA`
- `lib/warehouse.ts` — the `WAREHOUSE_QTY_OVERRIDDEN` insert in `submitValidationDecision`
- `lib/pr2-planning.ts` — `uploadPR2ItemAttachment`, `deletePR2ItemAttachment`, `deleteDraftRawMaterialPR2`
- `lib/accreditation.ts` / `lib/accreditation-documents.ts` — all existing inserts (already mostly `console.warn`; make consistent as `console.error` only where currently fully silent)

---

## Verification

1. After **every** phase: `npx tsc --noEmit` and `npx eslint <touched files>` — must be clean before continuing.
2. After Phase 0: log in as admin, deactivate/reactivate a test department and position via the UI, confirm `DEPARTMENT_DEACTIVATED`/`POSITION_REACTIVATED` etc. still appear in `/admin/audit` (this already worked before the change — confirms the gate removal didn't break the happy path).
3. After Phase 1: exercise each of the 4 routes once via the running app (create a test user, invite a test user, save SMTP settings, create a test catalog product for a raw-material supplier), confirm each produces exactly one new `audit_logs` row with the right action/document_id, then clean up the test rows the same way the earlier bulk-import test was cleaned up (delete via service-role script / Supabase MCP).
4. After Phase 2: submit a test draft accreditation, move it to under-review, upload a document, and revoke a previously-approved test accreditation; confirm all 4 actions appear, and specifically confirm the revoke shows `ACCREDITATION_REVOKED` not `ACCREDITATION_EXPIRED`.
5. After Phase 3: exercise each of the 7 functions once end-to-end in the browser (edit a raw-material PR2 draft, edit a PO draft, remove an external vendor from a draft RFQ, submit a supplier quotation, forward a GRN item to QA, open a warehouse validation, save validation progress) and confirm each produces the expected new audit_logs row with correct actor/document_id.
6. After Phase 4: no functional test needed (console-only change) — just confirm `tsc`/`eslint` stay clean and spot-check one site's server log output.
7. Final pass: re-run the same `select count(*) from audit_logs` sanity check style used earlier, and re-check `/admin/audit` pagination still works (confirms Phase 4/earlier count fix and this pass didn't interact badly).
