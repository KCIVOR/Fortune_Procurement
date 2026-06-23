# Supplier Quote Attachments — Implementation Plan

## Overview

Suppliers need to attach product images/specs to their RFQ quotation lines. Those attachments must remain visible to **all stakeholders** (procurement, approvers, warehouse, GRN) throughout the entire document chain: RFQ → PR2 → PO → Delivery → GRN.

---

## Architecture Decision

### The linkage problem
`pr2_items` has `selected_rfq_supplier_id` (links to `rfq_suppliers`) but no direct link to the specific `rfq_item_quotes` row. To load quote attachments downstream, we add `rfq_item_quote_id` as a nullable FK on `pr2_items` at PR2 generation time. This gives every downstream document a single, stable pointer back to the original quote — no multi-hop reconstruction needed.

### Attachment ownership model
- Attachments are stored in a **new `rfq-attachments` Supabase bucket**
- Metadata lives in a **new `rfq_quote_attachments` table**, keyed by `rfq_item_quote_id`
- Downstream documents (PR2, PO, GRN) load attachments **lazily at read time** via the `rfq_item_quote_id` chain — no copy/snapshot needed
- PR1 attachments (requisitioner) and quote attachments (supplier) are **separate and additive** — both shown side by side

---

## Visibility Matrix

| Surface | PR1 Attachments | Supplier Quote Attachments |
|---------|----------------|---------------------------|
| RFQ canvass view (procurement) | ✅ Already works | ✅ Phase 4 |
| Supplier quotation page | ✅ Phase 0 (done) | ✅ Phase 2 (upload) |
| PR2 detail page | ✅ Already works | ✅ Phase 5 |
| PR2 approval page | ❌ Not shown | ✅ Phase 5 |
| PO detail page | ❌ Not shown | ✅ Phase 6 |
| PO approval page | ❌ Not shown | ✅ Phase 6 |
| Delivery detail page | ❌ Not shown | ✅ Phase 7 |
| GRN detail page | ❌ Not shown | ✅ Phase 7 |

---

## Phases

---

### Phase 1 — Database & Storage Foundation
**Scope:** DB migration only. No UI changes.

#### 1a. Create `rfq_quote_attachments` table
```sql
CREATE TABLE public.rfq_quote_attachments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id           uuid NOT NULL REFERENCES rfq_batches(id) ON DELETE CASCADE,
  rfq_supplier_id  uuid NOT NULL REFERENCES rfq_suppliers(id) ON DELETE CASCADE,
  rfq_item_quote_id uuid NOT NULL REFERENCES rfq_item_quotes(id) ON DELETE CASCADE,
  pr1_item_id      uuid NOT NULL REFERENCES pr1_items(id) ON DELETE CASCADE,
  uploaded_by      uuid NOT NULL REFERENCES auth.users(id),
  storage_path     text NOT NULL,
  file_name        text NOT NULL,
  file_size        bigint,
  mime_type        text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rfq_quote_attachments_quote_idx  ON public.rfq_quote_attachments(rfq_item_quote_id);
CREATE INDEX rfq_quote_attachments_rfq_idx    ON public.rfq_quote_attachments(rfq_id);
CREATE INDEX rfq_quote_attachments_item_idx   ON public.rfq_quote_attachments(pr1_item_id);
```

#### 1b. Add `rfq_item_quote_id` FK to `pr2_items`
```sql
ALTER TABLE pr2_items
  ADD COLUMN rfq_item_quote_id uuid REFERENCES rfq_item_quotes(id);
```
Nullable — covers manually-created PR2s that have no RFQ origin.

#### 1c. Create `rfq-attachments` storage bucket
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rfq-attachments',
  'rfq-attachments',
  false,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
);
```

#### 1d. RLS policies

**Supplier upload** — only the assigned supplier, while RFQ is open:
```sql
CREATE POLICY "rfq_quote_attachments_insert"
ON public.rfq_quote_attachments FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM rfq_suppliers rs
    JOIN rfq_batches rb ON rb.id = rs.rfq_id
    WHERE rs.id = rfq_supplier_id
      AND rs.supplier_id = auth.uid()
      AND rb.status = 'open'
  )
);
```

**Read — all authorized roles** (supplier who uploaded + procurement + approvers + warehouse + GRN):
```sql
CREATE POLICY "rfq_quote_attachments_select"
ON public.rfq_quote_attachments FOR SELECT TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND p.role IN ('procurement','approver','warehouse','admin')
  )
  OR EXISTS (
    SELECT 1 FROM rfq_suppliers rs
    WHERE rs.id = rfq_supplier_id AND rs.supplier_id = auth.uid()
  )
);
```

**Supplier delete** — only own attachments, while RFQ is open:
```sql
CREATE POLICY "rfq_quote_attachments_delete"
ON public.rfq_quote_attachments FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM rfq_suppliers rs
    JOIN rfq_batches rb ON rb.id = rs.rfq_id
    WHERE rs.id = rfq_supplier_id AND rb.status = 'open'
  )
);
```

**Storage bucket policies** (mirror table policies):
- INSERT: supplier assigned to the rfq_supplier_id encoded in the path
- SELECT: same roles as table SELECT policy
- DELETE: same as table DELETE policy

Path convention: `rfq/{rfq_id}/{rfq_supplier_id}/{pr1_item_id}/{ts}_{filename}`

---

### Phase 2 — Upload Utility & Types
**Scope:** `lib/` utilities and TypeScript types. No UI changes yet.

#### 2a. Add `RfqQuoteAttachment` type to `types/canvassing.ts`
```typescript
export interface RfqQuoteAttachment {
  id:                string;
  rfq_id:            string;
  rfq_supplier_id:   string;
  rfq_item_quote_id: string;
  pr1_item_id:       string;
  uploaded_by:       string;
  storage_path:      string;
  file_name:         string;
  file_size:         number | null;
  mime_type:         string | null;
  created_at:        string;
}
```

Add to `RfqItemQuote`:
```typescript
export interface RfqItemQuote {
  // ... existing fields ...
  attachments?: RfqQuoteAttachment[];  // loaded at read time
}
```

Add to `QuoteMatrixRow.quote`:
```typescript
attachments?: RfqQuoteAttachment[];
```

Add to `SupplierQuoteDetail.items`:
```typescript
quote_attachments?: RfqQuoteAttachment[];  // per item, loaded from DB
```

#### 2b. Add upload/fetch/delete functions to `lib/canvassing.ts`

```typescript
export async function fetchRfqQuoteAttachments(
  rfqItemQuoteId: string
): Promise<RfqQuoteAttachment[]>

export async function uploadRfqQuoteAttachment(params: {
  rfqId:           string;
  rfqSupplierId:   string;
  rfqItemQuoteId:  string;
  pr1ItemId:       string;
  file:            File;
}): Promise<RfqQuoteAttachment>

export async function deleteRfqQuoteAttachment(
  attachmentId: string,
  storagePath:  string
): Promise<void>
```

Follow the same pattern as `uploadPR1Attachment` / `fetchPR1Attachments` in `lib/pr1.ts`.

#### 2c. Add `rfq_item_quote_id` to `PR2Item` type and `pr2_items` insert in `generatePR2FromRfq()`

In `types/pr2.ts`:
```typescript
export interface PR2Item {
  // ... existing fields ...
  rfq_item_quote_id?: string | null;  // link back to winning quote
}
```

In `lib/pr2.ts` → `generatePR2FromRfq()`, add `rfq_item_quote_id` to the insert payload:
- Look up `rfq_item_quotes` row matching `rfq_supplier_id + pr1_item_id` during PR2 generation
- Store its `id` as `rfq_item_quote_id` on the resulting `pr2_items` row

---

### Phase 3 — Supplier Upload UI
**Scope:** `app/supplier/quotations/[rfqSupplierId]/page.tsx` only.

#### What to build
Per-item attachment section, shown below the quotation form fields for each line. Pattern follows `PR1AttachmentsSection` but adapted for RFQ context.

- **Upload area:** small paperclip button or "+ Add Image/PDF" inline, opens file picker
- **Constraints:** max 3 files per quote line, 10 MB each, images + PDF only
- **Preview strip:** thumbnail chips with file name + remove button (same style as PR1 component)
- **State management:** pending files (not yet saved) vs. saved attachments (already in DB)
- **Timing:** files are uploaded immediately on selection (not on form submit), matching PR1 pattern
- **Locked when RFQ is closed:** attachment controls hidden in read-only mode

**New reusable component:** `components/rfq/RfqQuoteAttachmentSection.tsx`
- Props: `rfqId`, `rfqSupplierId`, `rfqItemQuoteId` (null if quote not yet submitted), `pr1ItemId`, `isReadOnly`
- Internally handles upload/delete via Phase 2 utilities
- Falls back gracefully when `rfqItemQuoteId` is null (pre-submit state — files staged in component state, uploaded on first save)

**Integration point in supplier page:**
- Rendered inside each item's form card, below the remarks field
- Conditional: only shown when `detail.rfqSupplier.status === 'open'` (editable) or when attachments exist (read-only view)

---

### Phase 4 — Procurement RFQ Canvass View
**Scope:** `app/rfq/[id]/page.tsx` and `lib/canvassing.ts` `fetchRfqDetail`.

#### 4a. Load attachments in `fetchRfqDetail`
In `lib/canvassing.ts`, enrich `RfqDetailView` quote data:
- After fetching quotes, batch-fetch `rfq_quote_attachments` for all quotes in this RFQ
- Group by `rfq_item_quote_id`, attach to each quote row
- This makes `detail.quotes[n].attachments` available

#### 4b. Display in the canvass matrix
In `app/rfq/[id]/page.tsx`, inside the `MatrixRow` component per supplier-column:
- Below the existing quoted description/price cell, add attachment gallery
- Reuse `PR1AttachmentsGallery` component (same look) or create `RfqQuoteAttachmentGallery` if styling differs
- "View (n)" button that opens a lightbox dialog
- Only rendered when `quote.attachments?.length > 0`

---

### Phase 5 — PR2 Pages
**Scope:** `lib/pr2.ts`, `app/pr2/[id]/page.tsx`, `app/approvals/pr2/[id]/page.tsx`.

#### 5a. Load in `fetchPR2ById`
In `lib/pr2.ts`:
- For each PR2 item that has a non-null `rfq_item_quote_id`, fetch `rfq_quote_attachments` for those IDs
- Attach as `quote_attachments?: RfqQuoteAttachment[]` on each `PR2Item`
- Existing `attachments` (PR1) and new `quote_attachments` (supplier) are separate arrays

#### 5b. PR2 detail page (`app/pr2/[id]/page.tsx`)
In the items table, add a new "Attachments" sub-section per item row:
- Row 1: PR1 item attachments (requisitioner's) — existing `PR1AttachmentsGallery`
- Row 2: Supplier quote attachments — new gallery, labelled "Supplier Docs"
- Only shown when the respective array is non-empty

#### 5c. PR2 approval page (`app/approvals/pr2/[id]/page.tsx`)
In the items table (read-only view for approvers):
- Same two-gallery pattern as PR2 detail page
- Load via `fetchPR2ApprovalDetail` → enrich PR2 items the same way

---

### Phase 6 — PO Pages
**Scope:** `lib/po.ts`, `app/po/[id]/page.tsx`, `app/approvals/[id]/page.tsx` (PO approval).

#### 6a. Add `rfq_item_quote_id` to `po_items`
```sql
ALTER TABLE po_items
  ADD COLUMN rfq_item_quote_id uuid REFERENCES rfq_item_quotes(id);
```
Populate at PO generation time: copy from the linked `pr2_items.rfq_item_quote_id`.

In `lib/po.ts` → `generatePOFromPR2()`:
- When building po_items insert payload, include `rfq_item_quote_id` from the source pr2_item

#### 6b. Load in `fetchPOById`
- Batch-fetch `rfq_quote_attachments` for all non-null `rfq_item_quote_id` values in po_items
- Attach as `quote_attachments?: RfqQuoteAttachment[]` on `POItem`

#### 6c. PO detail page (`app/po/[id]/page.tsx`)
- Same two-gallery pattern (PR1 + supplier) in items table
- PR1 attachments: load via existing `pr1_item_id` → `pr1_attachments` join (add if missing)
- Supplier attachments: load via `rfq_item_quote_id` → `rfq_quote_attachments`

#### 6d. PO approval page
- Approvers see both attachment types in the items table during approval review

---

### Phase 7 — Delivery & GRN Pages
**Scope:** `lib/delivery.ts`, `lib/grn.ts`, `app/grn/[id]/page.tsx`.

#### 7a. Delivery page
Delivery rows don't have item-level detail currently (header-only). No change needed unless a delivery items table is added in the future. Skip for now — GRN is the receipting point.

#### 7b. Add `rfq_item_quote_id` to `grn_items`
```sql
ALTER TABLE grn_items
  ADD COLUMN rfq_item_quote_id uuid REFERENCES rfq_item_quotes(id);
```
Populate when GRN items are created from po_items (copy the `rfq_item_quote_id` chain).

#### 7c. Load in `fetchGRNById`
- Batch-fetch `rfq_quote_attachments` for all `rfq_item_quote_id` values in grn_items
- Attach as `quote_attachments?: RfqQuoteAttachment[]` on `GRNItem`

#### 7d. GRN detail page (`app/grn/[id]/page.tsx`)
- Add per-item attachment display in the items table
- Warehouse staff receiving goods can reference supplier product images/specs during physical inspection
- Read-only — no upload capability at this stage

---

## Execution Order

| Phase | Deliverable | Risk | Dependency |
|-------|------------|------|-----------|
| 1 | DB migration (table + bucket + RLS) | Low — additive | None |
| 2 | Types + lib utilities + PR2 quote_id backfill | Low | Phase 1 |
| 3 | Supplier upload UI | Medium — new UX | Phase 2 |
| 4 | Procurement RFQ canvass view | Low — read only | Phase 2 |
| 5 | PR2 detail + approval pages | Low — read only | Phase 2 |
| 6 | PO detail + approval pages | Low — read only | Phase 2, DB column on po_items |
| 7 | GRN pages | Low — read only | Phase 2, DB column on grn_items |

---

## Component Reuse Strategy

- **Gallery (read-only view):** Reuse `PR1AttachmentsGallery` from `components/pr1/PR1AttachmentsSection.tsx` — it accepts `PR1Attachment[]` which has the same shape as `RfqQuoteAttachment`. Cast or make the prop type generic.
- **Uploader:** New `RfqQuoteAttachmentSection` in `components/rfq/` — similar to `PR1AttachmentsSection` but wired to different upload function and locked after RFQ closes.
- **Lightbox dialog:** Already shared by PR1 component — no new UI needed.

---

## Files Touched Summary

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_rfq_quote_attachments.sql` | New — Phase 1 |
| `types/canvassing.ts` | Add RfqQuoteAttachment, enrich RfqItemQuote + QuoteMatrixRow + SupplierQuoteDetail |
| `types/pr2.ts` | Add rfq_item_quote_id to PR2Item |
| `types/po.ts` | Add rfq_item_quote_id + quote_attachments to POItem |
| `types/grn.ts` | Add rfq_item_quote_id + quote_attachments to GRNItem |
| `lib/canvassing.ts` | Add fetch/upload/delete utils; enrich fetchRfqDetail + fetchSupplierQuoteDetail |
| `lib/pr2.ts` | Store rfq_item_quote_id at PR2 generation; load attachments in fetchPR2ById |
| `lib/po.ts` | Store rfq_item_quote_id at PO generation; load attachments in fetchPOById |
| `lib/grn.ts` | Load attachments in fetchGRNById |
| `components/rfq/RfqQuoteAttachmentSection.tsx` | New — Phase 3 uploader |
| `app/supplier/quotations/[rfqSupplierId]/page.tsx` | Add uploader per item — Phase 3 |
| `app/rfq/[id]/page.tsx` | Add gallery in canvass matrix — Phase 4 |
| `app/pr2/[id]/page.tsx` | Add supplier attachment gallery per item — Phase 5 |
| `app/approvals/pr2/[id]/page.tsx` | Add supplier attachment gallery per item — Phase 5 |
| `app/po/[id]/page.tsx` | Add attachment gallery per item — Phase 6 |
| `app/approvals/[id]/page.tsx` (PO approval) | Add attachment gallery per item — Phase 6 |
| `app/grn/[id]/page.tsx` | Add attachment gallery per item — Phase 7 |
