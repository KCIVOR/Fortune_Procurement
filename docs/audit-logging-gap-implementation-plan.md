# Audit Logging Gap — Implementation Plan

Fills every action gap found in the audit so an admin can trace the full
lifecycle of every document through `audit_logs`, `approval_actions`, and
`delivery_status_history`.

---

## What already works (do not touch)

| Module | Logged actions |
|---|---|
| PR1 submit + priority update | `PR1_SUBMITTED`, `PR1_PRIORITY_UPDATED` |
| PR1 / PR2 / PO approval steps | `approval_actions` rows + `audit_logs` action codes |
| PR2 generate, save items, raw-mat flag | `PR2_GENERATED`, `PR2_UPDATED`, `RAW_MATERIAL_FLAG_CHANGED` |
| RFQ issue, close, item selection, substitute | `RFQ_ISSUED`, `RFQ_CLOSED`, `RFQ_ITEM_SELECTED`, `RFQ_SELECTION_CLEARED`, etc. |
| PO generate + submit + acknowledge + mark ordered | `PO_SUBMITTED_FOR_APPROVAL`, `PO_ACKNOWLEDGED_BY_SUPPLIER`, `PO_MARKED_ORDERED_EXTERNAL` |
| Delivery status updates + follow-up notes | `delivery_status_history` rows |

---

## Confirmed gaps (agent audit, verified by reading function bodies)

| # | Function | File | Problem |
|---|---|---|---|
| 1 | `assignSuppliers` | `lib/canvassing.ts:716` | No `profile` param → cannot log actor |
| 2 | `addExternalVendorToRfq` | `lib/canvassing.ts:740` | No `profile` param → cannot log actor |
| 3 | `openGRNForDelivery` | `lib/grn.ts:265` | `profile` already passed, insert just missing |
| 4 | `closeGRN` | `lib/grn.ts:435` | Only `delivery_status_history`, no `audit_logs` |
| 5 | `saveGRNProgress` | `lib/grn.ts:409` | No `profile` param → cannot log actor |
| 6 | `saveDraftPR1` | `lib/pr1.ts:557` | `profile` already passed, insert just missing |
| 7 | `deleteDraftPR1` | `lib/pr1.ts:770` | `profile` already passed, insert just missing |
| 8 | `uploadPR1Attachment` | `lib/pr1.ts:929` | No `profile` param; `authUserId` available via `requireAuthUserId` |
| 9 | `deletePR1Attachment` | `lib/pr1.ts:970` | No `profile` or `actor_id` param at all |
| 10 | `uploadRfqQuoteAttachment` | `lib/canvassing.ts:1965` | Need to verify profile availability |
| 11 | `deleteRfqQuoteAttachment` | `lib/canvassing.ts:2013` | Need to verify profile availability |

---

## Guiding principles

- **Best-effort logging** — wrap every `audit_logs` insert in `try/catch` or use `.catch(() => {})` so a log failure never blocks the actual operation.
- **Minimum signature change** — only add `profile: UserProfile` where the function has no actor info at all. Otherwise just add the insert.
- **Caller updates are mandatory** when signature changes — list every call site and update it.
- **No new tables** — all inserts go to `audit_logs` (same shape already used everywhere).

### `audit_logs` row shape (for reference)
```ts
await db.from('audit_logs').insert({
  actor_id:      profile.id,          // uuid
  action:        'ACTION_CODE',       // snake_UPPER
  document_type: 'RFQ',              // 'PR1' | 'PR2' | 'RFQ' | 'PO' | 'GRN'
  document_id:   someId,             // uuid of the primary document
  payload:       { ...metadata },    // any additional context
}).catch(() => {});                   // best-effort
```

---

## Phase 1 — RFQ supplier assignment  *(requires signature change + caller update)*

**Priority: HIGH** — these are the earliest steps in the canvassing cycle.
Both functions lack a `profile` param today.

### 1-A `assignSuppliers` — `lib/canvassing.ts:716`

**Signature change:**
```ts
// Before
export async function assignSuppliers(
  rfqId: string,
  supplierIds: string[],
  allSuppliers: Pick<CanvassSupplierCandidate, 'id' | 'full_name'>[]
): Promise<void>

// After — add profile as last param
export async function assignSuppliers(
  rfqId: string,
  supplierIds: string[],
  allSuppliers: Pick<CanvassSupplierCandidate, 'id' | 'full_name'>[],
  profile: UserProfile
): Promise<void>
```

**Insert to add** (after the existing `if (error) throw error;`):
```ts
await db.from('audit_logs').insert({
  actor_id:      profile.id,
  action:        'RFQ_SUPPLIERS_ASSIGNED',
  document_type: 'RFQ',
  document_id:   rfqId,
  payload:       { supplier_ids: supplierIds, count: supplierIds.length },
}).catch(() => {});
```

**Caller to update — `app/rfq/[id]/page.tsx` line ~309:**
```ts
// Before
await assignSuppliers(rfq.id, Array.from(selectedIds), allSuppliers);

// After
await assignSuppliers(rfq.id, Array.from(selectedIds), allSuppliers, profile);
```

### 1-B `addExternalVendorToRfq` — `lib/canvassing.ts:740`

**Signature change:**
```ts
// Before
export async function addExternalVendorToRfq(
  rfqId: string,
  vendorName: string,
): Promise<void>

// After
export async function addExternalVendorToRfq(
  rfqId: string,
  vendorName: string,
  profile: UserProfile,
): Promise<void>
```

**Insert to add** (after the existing `if (error) throw error;`):
```ts
await db.from('audit_logs').insert({
  actor_id:      profile.id,
  action:        'RFQ_EXTERNAL_VENDOR_ADDED',
  document_type: 'RFQ',
  document_id:   rfqId,
  payload:       { vendor_name: name },
}).catch(() => {});
```

**Caller to update — `app/rfq/[id]/page.tsx` line ~325:**
```ts
// Before
await addExternalVendorToRfq(rfq.id, vendorName);

// After
await addExternalVendorToRfq(rfq.id, vendorName, profile);
```

**TypeScript check after Phase 1:** `npx tsc --noEmit`

---

## Phase 2 — GRN lifecycle  *(mix of easy inserts + one signature change)*

**Priority: HIGH** — GRN is currently completely dark to admins.

### 2-A `openGRNForDelivery` — `lib/grn.ts:265`

`profile` is already the second parameter. Just add the insert before `return grnId`:

```ts
await db.from('audit_logs').insert({
  actor_id:      profile.id,
  action:        'GRN_OPENED',
  document_type: 'GRN',
  document_id:   grnId,
  payload:       { delivery_id: deliveryId },
}).catch(() => {});

return grnId;
```

No caller changes needed.

### 2-B `closeGRN` — `lib/grn.ts:435`

`profile` is already the fourth parameter. Add after the existing `delivery_status_history` insert:

```ts
await db.from('audit_logs').insert({
  actor_id:      profile.id,
  action:        'GRN_CLOSED',
  document_type: 'GRN',
  document_id:   grnId,
  payload: {
    delivery_id:   deliveryId,
    dr_no:         values.dr_no.trim(),
    transaction_date: values.transaction_date,
    closed_by:     profile.full_name,
  },
}).catch(() => {});
```

No caller changes needed.

### 2-C `saveGRNProgress` — `lib/grn.ts:409`  *(requires signature change)*

`saveGRNProgress` is called from two places:
1. **Directly** from `app/grn/[id]/page.tsx` → "Save Progress" button
2. **Internally** from `closeGRN` → already handled by 2-B

Add `profile: UserProfile` as the third parameter. The insert only needs to fire
when called directly (not from `closeGRN`) — simplest approach: add it
unconditionally and let `closeGRN` produce its own separate `GRN_CLOSED` entry.

**Signature change:**
```ts
// Before
export async function saveGRNProgress(
  grnId: string,
  values: GRNFormValues
): Promise<void>

// After
export async function saveGRNProgress(
  grnId: string,
  values: GRNFormValues,
  profile: UserProfile,
): Promise<void>
```

**Insert to add** (end of function, after the `grn_items` update loop):
```ts
await db.from('audit_logs').insert({
  actor_id:      profile.id,
  action:        'GRN_PROGRESS_SAVED',
  document_type: 'GRN',
  document_id:   grnId,
  payload:       { item_count: values.items.length },
}).catch(() => {});
```

**Callers to update:**

`lib/grn.ts` — inside `closeGRN` (line ~437):
```ts
// Before
await saveGRNProgress(grnId, values);

// After
await saveGRNProgress(grnId, values, profile);
```

`app/grn/[id]/page.tsx` — "Save Progress" handler:
```ts
// Before
await saveGRNProgress(grn.id, formValues);

// After
await saveGRNProgress(grn.id, formValues, profile);
```

**TypeScript check after Phase 2:** `npx tsc --noEmit`

---

## Phase 3 — PR1 draft lifecycle  *(pure inserts, no signature change)*

**Priority: MEDIUM** — `profile` is already a param in both functions.

### 3-A `saveDraftPR1` — `lib/pr1.ts:557`

At the end of the function, before `return { id: pr1Id, items: syncedItems }`:

```ts
await db.from('audit_logs').insert({
  actor_id:      profile.id,
  action:        existingId ? 'PR1_DRAFT_UPDATED' : 'PR1_DRAFT_CREATED',
  document_type: 'PR1',
  document_id:   pr1Id,
  payload: {
    pr1_number: values.pr1_number.trim(),
    purpose:    values.purpose.trim(),
    item_count: values.items.length,
  },
}).catch(() => {});
```

No caller changes needed.

### 3-B `deleteDraftPR1` — `lib/pr1.ts:770`

Since the PR1 is deleted we log it **before** the deletes (so the document_id
is still meaningful in audit history):

```ts
// Insert BEFORE the pr1_items delete
await db.from('audit_logs').insert({
  actor_id:      profile.id,
  action:        'PR1_DRAFT_DELETED',
  document_type: 'PR1',
  document_id:   pr1Id,
  payload:       { deleted_by: profile.full_name },
}).catch(() => {});
```

No caller changes needed.

**TypeScript check after Phase 3:** `npx tsc --noEmit`

---

## Phase 4 — Attachment operations  *(low priority, best-effort only)*

**Priority: LOW** — file attach/detach are supplementary; no actor full-name
available in most of these functions, but `actor_id` can be retrieved from the
existing `requireAuthUserId()` call or the auth context.

### 4-A PR1 attachments — `lib/pr1.ts`

Both functions use `const authUserId = await requireAuthUserId()` internally,
so actor_id is available.

**`uploadPR1Attachment` (line ~929)** — add after the successful `insert`:
```ts
await db.from('audit_logs').insert({
  actor_id:      authUserId,
  action:        'PR1_ATTACHMENT_UPLOADED',
  document_type: 'PR1',
  document_id:   pr1Id,
  payload:       { file_name: file.name, file_size: file.size, pr1_item_id: pr1ItemId },
}).catch(() => {});
```

**`deletePR1Attachment` (line ~970)** — this function has no actor context.
Add an optional `actorId?: string` param and log only when provided. Callers
that have `profile` available (the PR1 edit page) pass `profile.id`; callers
that don't can omit it.

```ts
export async function deletePR1Attachment(
  attachment: PR1Attachment,
  actorId?: string,
): Promise<void> {
  // ... existing deletes ...

  if (actorId) {
    await db.from('audit_logs').insert({
      actor_id:      actorId,
      action:        'PR1_ATTACHMENT_DELETED',
      document_type: 'PR1',
      document_id:   attachment.pr1_id,
      payload:       { file_name: attachment.file_name, pr1_item_id: attachment.pr1_item_id },
    }).catch(() => {});
  }
}
```

### 4-B RFQ quote attachments — `lib/canvassing.ts`

Check whether `uploadRfqQuoteAttachment` and `deleteRfqQuoteAttachment` already
receive a `profile` param. If yes, add the insert directly. If not, add an
optional `actorId?: string` param (same pattern as 4-A above).

Action codes to use:
- `'RFQ_QUOTE_ATTACHMENT_UPLOADED'`
- `'RFQ_QUOTE_ATTACHMENT_DELETED'`

**TypeScript check after Phase 4:** `npx tsc --noEmit`

---

## Execution order summary

| Phase | Files changed | Signature change? | Callers to update | Priority |
|---|---|---|---|---|
| 1 — RFQ supplier assignment | `lib/canvassing.ts` | ✅ x2 | `app/rfq/[id]/page.tsx` x2 | HIGH |
| 2 — GRN lifecycle | `lib/grn.ts` | ✅ x1 (`saveGRNProgress`) | `lib/grn.ts` (internal) + `app/grn/[id]/page.tsx` | HIGH |
| 3 — PR1 draft lifecycle | `lib/pr1.ts` | ✗ | None | MEDIUM |
| 4 — Attachment ops | `lib/pr1.ts`, `lib/canvassing.ts` | ✅ x1 optional | 1 PR1 caller | LOW |

Run `npx tsc --noEmit` after each phase before moving to the next.

---

## New action codes reference

| Code | Trigger |
|---|---|
| `RFQ_SUPPLIERS_ASSIGNED` | Procurement selects registered suppliers for an RFQ |
| `RFQ_EXTERNAL_VENDOR_ADDED` | Procurement adds an off-system vendor to an RFQ |
| `GRN_OPENED` | Warehouse clicks "Receive Goods" to start a GRN |
| `GRN_PROGRESS_SAVED` | Warehouse saves partial GRN item quantities |
| `GRN_CLOSED` | Warehouse finalises and closes the GRN |
| `PR1_DRAFT_CREATED` | Employee saves a new draft PR1 |
| `PR1_DRAFT_UPDATED` | Employee edits and re-saves an existing draft PR1 |
| `PR1_DRAFT_DELETED` | Employee deletes a draft PR1 |
| `PR1_ATTACHMENT_UPLOADED` | Employee attaches a file to a PR1 item |
| `PR1_ATTACHMENT_DELETED` | Employee removes an attachment from a PR1 item |
| `RFQ_QUOTE_ATTACHMENT_UPLOADED` | Procurement uploads a file to a supplier quote |
| `RFQ_QUOTE_ATTACHMENT_DELETED` | Procurement removes a file from a supplier quote |
