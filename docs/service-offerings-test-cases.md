# Service Offerings — Manual Test Cases

All tests verify the 10-phase implementation of `item_type: 'goods' | 'services'` on `supplier_products`.

---

## Prerequisites

- At least one supplier user account (e.g. `supplier@test.com`)
- At least one procurement/admin user account
- At least one approved PR1 request with status `for_canvassing` (for RFQ tests)
- Dev server running (`npm run dev`)

---

## Phase 1 — Database Column

### TC-DB-01: Column exists with correct default
**How:** Run in Supabase SQL editor:
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'supplier_products'
  AND column_name = 'item_type';
```
**Expected:**
- `column_name` = `item_type`
- `data_type` = `text`
- `column_default` = `'goods'`
- `is_nullable` = `NO`

### TC-DB-02: Check constraint enforces allowed values
**How:** Run in Supabase SQL editor:
```sql
INSERT INTO supplier_products (supplier_id, product_name, status, item_type)
VALUES ('00000000-0000-0000-0000-000000000000', 'test', 'draft', 'invalid_value');
```
**Expected:** Error — `check constraint "supplier_products_item_type_check"` violated.

### TC-DB-03: All pre-existing products defaulted to 'goods'
**How:**
```sql
SELECT COUNT(*) FROM supplier_products WHERE item_type != 'goods';
```
**Expected:** Count = 0 (all legacy rows defaulted to `goods`).

### TC-DB-04: Index created
**How:**
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'supplier_products'
  AND indexname = 'idx_supplier_products_item_type';
```
**Expected:** Row returned.

---

## Phase 2 — Types

### TC-TYPE-01: TypeScript compiles without errors
**How:** `npx tsc --noEmit`
**Expected:** No output (zero errors).

---

## Phase 4 — Supplier: Add New Product/Service

### TC-ADD-01: Default state shows Goods toggle selected
**Steps:**
1. Log in as supplier
2. Go to `/supplier/products/new`

**Expected:**
- "Goods" button is active (blue)
- "Services" button is inactive
- Page title: "Add Product"
- "Product Code / SKU" field is visible
- Label says "Product Name"
- Description label says "Description"
- Specifications label says "Specifications"

---

### TC-ADD-02: Switching to Services hides Product Code and changes labels
**Steps:**
1. Go to `/supplier/products/new`
2. Click "Services" toggle

**Expected:**
- "Services" button is active (blue), "Goods" is inactive
- Page title changes to "Add Service Offering"
- "Product Code / SKU" field disappears
- Label changes: "Product Name" → "Service Name"
- Description label → "Scope of Service"
- Specifications label → "Terms & Conditions / SLA"
- Placeholder for name: "e.g. Annual Preventive Maintenance, IT Consulting"
- Category placeholder: "e.g. Maintenance, Consulting, Security, IT Services"

---

### TC-ADD-03: Switching back to Goods restores fields
**Steps:**
1. Go to `/supplier/products/new`
2. Click "Services"
3. Click "Goods"

**Expected:**
- "Product Code / SKU" field reappears
- All labels revert to Goods defaults
- Page title reverts to "Add Product"

---

### TC-ADD-04: Save a Goods product
**Steps:**
1. `/supplier/products/new` — Goods selected (default)
2. Fill in Product Name: "Test Chemical A"
3. Product Code: "CHEM-001"
4. Click "Save as Draft"

**Expected:**
- Redirects to `/supplier/products/{new-id}`
- Product detail card header shows **blue** "Goods" badge
- Product Code row is visible with "CHEM-001"
- `item_type = 'goods'` in DB

---

### TC-ADD-05: Save a Services product
**Steps:**
1. `/supplier/products/new`
2. Click "Services"
3. Fill in Service Name: "Annual HVAC Maintenance"
4. Category: "Maintenance"
5. Scope of Service: "Full inspection and service of all HVAC units"
6. Click "Save as Draft"

**Expected:**
- Redirects to `/supplier/products/{new-id}`
- Product detail card header shows **purple** "Services" badge
- Product Code row is hidden
- Labels show "Scope of Service" (not "Description"), "Terms & Conditions / SLA" (not "Specifications")
- `item_type = 'services'` in DB

---

### TC-ADD-06: Validation requires name for services
**Steps:**
1. `/supplier/products/new` → Services
2. Leave name blank
3. Click "Save as Draft"

**Expected:** Error message: "Service name is required."

---

## Phase 5 — Supplier: Product Detail/Edit

### TC-DETAIL-01: Goods product shows correct detail view
**Steps:**
1. Open a goods product (`item_type = 'goods'`) at `/supplier/products/{id}`

**Expected:**
- Blue "Goods" badge in header
- "Product Code" row visible
- Labels: "Description", "Specifications"
- Card header: "Product Details"
- RSE/TSQA section visible (if records exist)

---

### TC-DETAIL-02: Services product shows correct detail view
**Steps:**
1. Open a service product (`item_type = 'services'`) at `/supplier/products/{id}`

**Expected:**
- Purple "Services" badge in header
- "Product Code" row hidden
- Labels: "Scope of Service", "Terms & Conditions / SLA"
- Card header: "Service Details"
- RSE/TSQA section hidden

---

### TC-DETAIL-03: Goods product edit mode shows full form
**Steps:**
1. Open a goods product in `draft` status
2. Click "Edit"

**Expected:**
- Goods/Services toggle visible and set to "Goods"
- Product Code field visible
- Standard labels (Product Name, Description, Specifications)

---

### TC-DETAIL-04: Services product edit mode hides Product Code
**Steps:**
1. Open a services product in `draft` status
2. Click "Edit"

**Expected:**
- Toggle locked to "Services" (or shows Services active)
- Product Code field hidden
- Labels: Service Name, Scope of Service, Terms & Conditions / SLA

---

### TC-DETAIL-05: Submit hint text differs for services
**Steps:**
1. Open a services product in `draft` status (not yet submitted)

**Expected:**
- Submit button hint/description contains "service offering" (not "product")

---

### TC-DETAIL-06: Saving edits to a services product clears product_code
**Steps:**
1. Open a services product in `draft` status
2. Click Edit
3. Save without changes

**Verify in DB:**
```sql
SELECT product_code FROM supplier_products WHERE item_type = 'services';
```
**Expected:** All rows have `product_code = NULL`.

---

## Phase 6 — Supplier: Product Catalog List

### TC-LIST-01: Type column visible in list
**Steps:**
1. Go to `/supplier/products`

**Expected:**
- "Type" column header visible on desktop (md+ breakpoint)
- Each goods row shows blue "Goods" badge
- Each services row shows purple "Services" badge

---

### TC-LIST-02: Type filter — filter to Goods only
**Steps:**
1. Go to `/supplier/products`
2. Set Type filter to "Goods"
3. Click Apply

**Expected:**
- Only goods products shown
- Services products hidden
- Result count reflects filtered count

---

### TC-LIST-03: Type filter — filter to Services only
**Steps:**
1. Go to `/supplier/products`
2. Set Type filter to "Services"
3. Click Apply

**Expected:**
- Only services products shown
- Goods products hidden

---

### TC-LIST-04: Type filter — All shows everything
**Steps:**
1. Apply "Goods" filter first
2. Change Type to "All types" and Apply

**Expected:** All products visible again.

---

### TC-LIST-05: Clear filters resets Type
**Steps:**
1. Set Type = "Services" and Status = "Draft"
2. Click "Clear"

**Expected:** All filters reset, all products visible.

---

### TC-LIST-06: Services product hides product_code in list row
**Steps:**
1. Go to `/supplier/products`
2. Find a services product row

**Expected:** Product code (e.g. `#CHEM-001`) not shown in the name/meta area.

---

### TC-LIST-07: "Add to Catalog" button label
**Steps:**
1. Go to `/supplier/products`

**Expected:** Button says "Add to Catalog" (not "Add Product").

---

## Phase 7 — Procurement: Product Accreditation Review

### TC-ACCRED-01: Goods product shows full action set
**Steps:**
1. Log in as procurement
2. Go to `/accreditation/products/{id}` for a goods product in `submitted` or `under_review` status

**Expected:**
- "Create RSE for TSQA" button is visible
- "Verify Directly" button is visible
- RSE/TSQA evaluation records section visible (if any records exist)

---

### TC-ACCRED-02: Services product hides RSE button
**Steps:**
1. Go to `/accreditation/products/{id}` for a services product in `submitted` or `under_review` status

**Expected:**
- **No** "Create RSE for TSQA" button
- "Verify Directly" button IS visible
- RSE/TSQA records section hidden

---

### TC-ACCRED-03: Services product shows type badge in header
**Steps:**
1. Go to `/accreditation/products/{id}` for a services product

**Expected:**
- Purple "Services" badge next to the product name in the header

---

### TC-ACCRED-04: Goods product shows type badge in header
**Steps:**
1. Go to `/accreditation/products/{id}` for a goods product

**Expected:**
- Blue "Goods" badge next to the product name in the header

---

### TC-ACCRED-05: Services product hides Product Code in detail card
**Steps:**
1. Go to `/accreditation/products/{id}` for a services product

**Expected:**
- "Product Code" row not shown in the product details grid
- Labels show "Scope of Service" and "Terms & Conditions / SLA"

---

### TC-ACCRED-06: Services "Verify Directly" panel has service-specific description
**Steps:**
1. Go to `/accreditation/products/{id}` for a services product
2. Open the "Verify Directly" panel/button

**Expected:**
- Description text mentions: *"Service offerings do not require TSQA/RSE evaluation"*
- Does NOT say "TSQA evaluation is not required for this product"

---

### TC-ACCRED-07: Documents section heading for services
**Steps:**
1. Go to `/accreditation/products/{id}` for a services product

**Expected:** Section heading says "Supporting Documents" (not "Product Documents").

---

### TC-ACCRED-08: Goods product documents heading
**Steps:**
1. Go to `/accreditation/products/{id}` for a goods product

**Expected:** Section heading says "Product Documents".

---

### TC-ACCRED-09: Services product can be verified directly without RSE
**Steps:**
1. Go to `/accreditation/products/{id}` for a services product in `submitted` status
2. Click "Verify Directly"
3. Confirm

**Expected:**
- Product status changes to `verified`
- No RSE record required
- "Can Offer" = Yes

---

## Phase 8 — Canvassing: Supplier Assignment Modal

### TC-MODAL-01: Modal shows split Goods/Services verified counts
**Steps:**
1. Log in as procurement
2. Go to an RFQ at `/rfq/{id}` with `draft` or `open` status
3. Click "Assign Suppliers"

**Expected in table (desktop):**
- "Goods ✓" column header (blue text)
- "Services ✓" column header (purple text)
- "Verified" single column is gone
- Each supplier row shows count in blue for goods, purple for services

**Expected in cards (mobile):**
- "Verified Goods" label with blue count
- "Verified Services" label with purple count
- "Withdrawn" row removed (replaced by the split above)

---

### TC-MODAL-02: Supplier with only goods shows 0 Services
**Steps:**
1. Find a supplier who has verified goods products but no services
2. Open Assign Suppliers modal

**Expected:**
- Goods ✓ = N (number of verified goods)
- Services ✓ = 0

---

### TC-MODAL-03: Supplier with only services shows 0 Goods
**Steps:**
1. Find a supplier who has only verified services products
2. Open Assign Suppliers modal

**Expected:**
- Goods ✓ = 0
- Services ✓ = N

---

### TC-MODAL-04: Product inventory badges show specific counts
**Steps:**
1. Open Assign Suppliers modal

**Expected for a supplier with 2 verified goods and 1 verified service:**
- Blue badge: "2 Verified Goods"
- Purple badge: "1 Verified Service"
- NO "Has Verified Products" generic badge

**Expected for a supplier with no verified products:**
- "No Verified Products" badge (neutral)

---

### TC-MODAL-05: Readiness "Ready" still works for suppliers with any verified product
**Steps:**
1. Find an accredited supplier with at least 1 verified product (goods or services)
2. Open Assign Suppliers modal

**Expected:** Readiness column/section shows "Ready" (green).

---

## Phase 9 — Supplier: Quotation Form

### TC-QUOTE-GOODS-01: Goods RFQ shows standard labels
**Steps:**
1. Log in as supplier
2. Go to `/supplier/quotations/{rfqSupplierId}` for an RFQ from a PR1 with `request_type = 'goods'`

**Expected:**
- Mode tab says "Select Catalog Product"
- Mode tab says "Propose New Product"
- Catalog sidebar heading: "Catalog Products"
- "Quoted Item / Specification" label
- "Lead Time (days)" label
- Picker dialog title: "Select Catalog Product"

---

### TC-QUOTE-SERVICES-01: Services RFQ shows service-aware labels
**Steps:**
1. Go to `/supplier/quotations/{rfqSupplierId}` for an RFQ from a PR1 with `request_type = 'services'`

**Expected:**
- Mode tab says "Select Catalog Service" (not "Select Catalog Product")
- Mode tab says "Propose New Service" (not "Propose New Product")
- Catalog sidebar heading: "Catalog Services"
- "Quoted Service / Description" label (not "Quoted Item / Specification")
- "Delivery Timeline (days)" label (not "Lead Time (days)")
- Picker dialog title: "Select Catalog Service"

---

### TC-QUOTE-SERVICES-02: Propose New Service form hides Product Code
**Steps:**
1. Services RFQ quotation page
2. Click "Propose New Service"

**Expected:**
- Field label: "Service Name *" (not "Product Name *")
- No "Product Code" field
- Category placeholder: "e.g. Maintenance, Consulting, IT Services"
- Description label: "Scope of Service (optional)"
- Specifications label: "Terms & Conditions / SLA (optional)"
- Description placeholder: "Describe what is included in this service offering"

---

### TC-QUOTE-SERVICES-03: Empty catalog message for services
**Steps:**
1. Services RFQ quotation page
2. Click "Select Catalog Service"
3. Ensure supplier has no catalog products

**Expected:**
- Message: "No catalog services yet."
- Link: "Add to your Catalog"

---

### TC-QUOTE-SERVICES-04: Picker dialog description for services
**Steps:**
1. Services RFQ quotation page
2. Click "Select Catalog Service" → catalog picker opens

**Expected:**
- Dialog description says "service offering" not "product"

---

### TC-QUOTE-SERVICES-05: Goods RFQ still shows product code in propose form
**Steps:**
1. Goods RFQ quotation page
2. Click "Propose New Product"

**Expected:**
- Field label: "Product Name *"
- "Product Code (optional)" field IS visible
- Standard placeholder text for product

---

## Phase 10 — productLookup item_type in RFQ Matrix

### TC-MATRIX-01: Quote matrix row carries item_type for linked service product
**How (DB verification):**
1. Create a services product, get it verified
2. Assign a supplier to an RFQ
3. Supplier quotes and selects the services product
4. In procurement RFQ detail, confirm the quote cell shows the linked product correctly

**DB check:**
```sql
SELECT sp.item_type, iq.supplier_product_id
FROM rfq_item_quotes iq
JOIN supplier_products sp ON sp.id = iq.supplier_product_id
WHERE iq.supplier_product_id IS NOT NULL;
```
**Expected:** `item_type` column shows `'services'` for service products.

---

### TC-MATRIX-02: TypeScript type check passes
**How:** `npx tsc --noEmit`
**Expected:** Zero errors — `supplier_product_item_type` field correctly typed as `'goods' | 'services' | null` in `QuoteMatrixRow`.

---

## End-to-End Flows

### E2E-01: Full Services Flow — Supplier Side
1. Supplier logs in → `/supplier/products/new`
2. Clicks "Services" → fills "Annual Pest Control Service"
3. Saves as Draft → product detail shows purple "Services" badge, no product code
4. Uploads a supporting document
5. Clicks "Submit for Review"
6. Status changes to "Submitted"

**Expected at each step:** No errors, correct labels throughout.

---

### E2E-02: Full Services Flow — Procurement Accreditation
1. Procurement opens `/accreditation/products/{id}` for the submitted service
2. Sees purple "Services" badge, "Supporting Documents", no RSE button
3. Clicks "Verify Directly"
4. Status changes to "Verified", Can Offer = Yes
5. No RSE record created

**Expected:** Service verified without going through TSQA evaluation.

---

### E2E-03: Full Services RFQ Flow
1. PR1 created with `request_type = 'services'`
2. Procurement creates RFQ → opens Assign Suppliers modal
3. Modal shows "Goods ✓" / "Services ✓" split counts
4. Supplier assigned → supplier opens quotation at `/supplier/quotations/{id}`
5. Sees "Select Catalog Service", "Propose New Service", "Delivery Timeline (days)"
6. Selects verified service product → quotes price
7. Submits quotation
8. Procurement sees linked service product in canvassing matrix

**Expected:** Service-specific labels at every step, no goods-specific text leaking through.

---

### E2E-04: Mixed Catalog — Goods and Services Co-exist
1. Supplier has both goods and services products in catalog
2. Go to `/supplier/products`
3. Type filter = "Goods" → only goods show
4. Type filter = "Services" → only services show
5. Type filter = "All" → both show with correct badges

**Expected:** Filtering is correct, badges are correct, no cross-contamination.

---

### E2E-05: Goods flow unchanged (regression)
1. Create a goods product → verify it goes through normal flow
2. RSE/TSQA section visible in procurement review
3. "Create RSE for TSQA" button present
4. Product Code field present throughout
5. All labels standard (Product Name, Description, Specifications)
6. Goods RFQ quotation shows "Lead Time (days)", "Quoted Item / Specification"

**Expected:** Zero regressions — goods behavior exactly as before.

---

## Regression Checks

| Area | What to verify |
|------|---------------|
| Existing goods products | `item_type = 'goods'` in DB, all pages render correctly |
| PR1 submission | Not affected — PR1 doesn't have `item_type` |
| Warehouse validation | Not affected — client confirmed services go through same flow |
| PO / PR2 / GRN / Delivery | Not affected — `item_type` is only on `supplier_products` |
| RFQ creation | Not affected — RFQ reads from PR1 `request_type`, not supplier products |
| Canvassing queue | Not affected — `request_type` already on PR1, no change to queue |
| Supplier accreditation (company-level) | Not affected — `supplier_accreditations` table unchanged |

---

## Quick Smoke Test Checklist

Run this before and after deployment:

- [ ] `/supplier/products/new` — toggles between Goods and Services, both save correctly
- [ ] `/supplier/products` — Type filter works, badges visible
- [ ] `/supplier/products/{goods-id}` — blue badge, product code visible, RSE section visible
- [ ] `/supplier/products/{service-id}` — purple badge, no product code, RSE section hidden
- [ ] `/accreditation/products/{goods-id}` — RSE button visible
- [ ] `/accreditation/products/{service-id}` — RSE button hidden, verify directly available
- [ ] RFQ Assign Suppliers modal — Goods ✓ / Services ✓ columns visible
- [ ] Goods RFQ quotation — "Select Catalog Product", "Lead Time (days)"
- [ ] Services RFQ quotation — "Select Catalog Service", "Delivery Timeline (days)"
- [ ] `npx tsc --noEmit` — zero errors
