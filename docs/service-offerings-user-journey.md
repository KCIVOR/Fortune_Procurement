# Service Offerings — Step-by-Step User Journey

This document walks through every user-facing change introduced by the Service Offerings feature, screen by screen, click by click.

---

## Journey 1: Supplier Adds a Service Offering

**Who:** Supplier user  
**Starting point:** Supplier is logged in and wants to register a new service (e.g. Annual HVAC Maintenance)

---

### Step 1 — Open the Product Catalog

1. Log in as supplier.
2. In the sidebar, click **Product Catalog**.
3. You land on `/supplier/products`.

**What you see:**
- A list of your existing products (if any), each with a **Type** column showing either a blue "Goods" badge or a purple "Services" badge.
- A filter bar with **Search**, **Type** (All types / Goods / Services), and **Status** dropdowns.
- A button labeled **"Add to Catalog"** (top right).

---

### Step 2 — Click "Add to Catalog"

1. Click the **"Add to Catalog"** button.
2. You land on `/supplier/products/new`.

**What you see:**
- Page title: **"Add Product"**
- An **Offering Type** toggle with two buttons: **Goods** | **Services** — "Goods" is active (blue) by default.
- Standard form fields: Product Name, Product Code / SKU, Category, Description, Specifications.

---

### Step 3 — Switch to Services

1. Click the **"Services"** button in the Offering Type toggle.

**What changes immediately:**
- Page title updates to **"Add Service Offering"**
- The **Product Code / SKU** field disappears.
- "Product Name" label → **"Service Name"**
- "Description" label → **"Scope of Service"**
- "Specifications" label → **"Terms & Conditions / SLA"**
- Placeholders update to service-relevant examples (e.g. "e.g. Annual Preventive Maintenance, IT Consulting").
- A note below the toggle reads: *"Register a service offering (consulting, maintenance, support, etc.)."*

---

### Step 4 — Fill in the Service Details

1. **Service Name:** `Annual HVAC Maintenance`
2. **Category:** `Maintenance`
3. **Scope of Service:** `Full inspection, cleaning, and servicing of all HVAC units including filters, coils, and drainage systems.`
4. **Terms & Conditions / SLA:** `Response within 24 hours. Scheduled annually. Service covers parts and labor. Exclusions: compressor replacement.`

---

### Step 5 — Save as Draft

1. Click **"Save as Draft"**.
2. You are redirected to `/supplier/products/{new-id}`.

**What you see on the detail page:**
- The product name "Annual HVAC Maintenance" in the header.
- A **purple "Services" badge** right next to the name.
- Card heading: **"Service Details"** (not "Product Details").
- **No Product Code row** in the detail card.
- "Description" field shows as **"Scope of Service"**.
- "Specifications" field shows as **"Terms & Conditions / SLA"**.
- Status chip: **Draft**.
- Submit button hint mentions **"service offering"**.
- **No RSE/TSQA evaluation section** at the bottom.

---

### Step 6 — Upload Supporting Documents (optional)

1. In the **Supporting Documents** section (note: not "Product Documents").
2. Click **Upload** and attach a service contract or company profile PDF.

---

### Step 7 — Submit for Review

1. Click **"Submit for Review"** (or equivalent submit button).
2. Status changes to **"Submitted"**.

The service offering now awaits Procurement verification.

---

## Journey 2: Supplier Browses and Filters the Catalog

**Who:** Supplier user  
**Starting point:** Supplier has a mix of goods and services in their catalog

---

### Step 1 — View the Catalog List

1. Go to `/supplier/products`.

**What you see:**
- Each row has a **Type** column (5th column on desktop):
  - Goods products show a **blue "Goods"** badge.
  - Services products show a **purple "Services"** badge.
- Services rows do **not** show a product code in the name/meta area.
- Goods rows show `#SKU-CODE` under the product name (if set).

---

### Step 2 — Filter by Type: Services

1. In the filter bar, open the **Type** dropdown.
2. Select **"Services"**.
3. Click **Apply**.

**What you see:**
- Only service offerings are listed.
- Result count reflects the filtered number (e.g. "3 products").

---

### Step 3 — Filter by Type: Goods

1. Change the **Type** dropdown to **"Goods"**.
2. Click **Apply**.

**What you see:**
- Only goods products are listed.
- Services are hidden.

---

### Step 4 — Clear Filters

1. Click **"Clear"** in the filter bar.

**What happens:**
- Type filter resets to "All types".
- Status filter resets to "All Statuses".
- Search resets.
- All products visible again.

---

## Journey 3: Supplier Edits an Existing Service Offering

**Who:** Supplier user  
**Starting point:** Supplier has a service offering in Draft status

---

### Step 1 — Open the Service Offering

1. From `/supplier/products`, click **View** on a services product.
2. You see the purple "Services" badge, no product code, service-specific labels.

---

### Step 2 — Enter Edit Mode

1. Click the **"Edit"** button.

**What you see in edit mode:**
- **Offering Type toggle** is visible, locked to "Services" (cannot change type once created — this prevents accidental type switching).
- Product Code field is **hidden**.
- Labels: Service Name, Scope of Service, Terms & Conditions / SLA.

---

### Step 3 — Update the Details

1. Edit the Scope of Service field.
2. Click **"Save"**.

**Result:** Changes saved. Read-only view returns with updated content, still showing the purple badge and service labels.

---

## Journey 4: Procurement Reviews and Verifies a Service Offering

**Who:** Procurement / Accreditation officer  
**Starting point:** A supplier has submitted a service offering for review

---

### Step 1 — Open the Accreditation Review Page

1. Log in as procurement.
2. Navigate to **Accreditation → Products** (or go directly to `/accreditation/products/{id}`).

---

### Step 2 — What You See for a Services Product

**Header area:**
- Product name with a **purple "Services" badge** next to it.
- Status chip (e.g. "Submitted").

**Product details card:**
- **No "Product Code" row**.
- "Description" shows as **"Scope of Service"**.
- "Specifications" shows as **"Terms & Conditions / SLA"**.

**Action buttons (right panel):**
- "Mark Under Review" — visible.
- "Verify Directly" — visible.
- **"Create RSE for TSQA" — NOT visible** (services don't require physical testing).

**Documents section:**
- Heading says **"Supporting Documents"** (not "Product Documents").

---

### Step 3 — Mark Under Review (optional)

1. Click **"Mark Under Review"**.
2. Status changes to "Under Review".
3. Still no "Create RSE for TSQA" button.

---

### Step 4 — Verify the Service Directly

1. Click **"Verify Directly"**.
2. A confirmation panel/dialog appears.

**Description text says:**
> *"Service offerings do not require TSQA/RSE evaluation. Verify after reviewing the supplier's credentials and service documentation. After verification, Can Offer = Yes."*

3. Confirm the verification.
4. Status changes to **"Verified"**.
5. Can Offer = **Yes**.

No RSE record is created. The service is now ready to be offered in procurement.

---

### Step 5 — Contrast with a Goods Product (same page, different product)

For a goods product, you would see:
- Blue "Goods" badge.
- Product Code row visible.
- "Create RSE for TSQA" button **is** visible.
- "Product Documents" heading.
- RSE/TSQA evaluation records section at the bottom.

---

## Journey 5: Procurement Assigns Suppliers to an RFQ

**Who:** Procurement officer  
**Starting point:** An RFQ is in Draft or Open status; procurement wants to assign suppliers

---

### Step 1 — Open the RFQ

1. Go to `/rfq/{id}`.
2. Click **"Assign Suppliers"** (or the equivalent assign button).

The **Canvass Suppliers** modal opens.

---

### Step 2 — What You See in the Modal

**Table view (desktop — lg+ screen):**

| Supplier | Email | Accreditation | Goods ✓ | Services ✓ | Pending | Rejected | Withdrawn | Readiness |
|----------|-------|---------------|---------|------------|---------|----------|-----------|-----------|
| ABC Corp | ... | Accredited | 3 | 0 | 1 | 0 | 0 | Ready |
| XYZ Services | ... | Accredited | 0 | 2 | 0 | 0 | 0 | Ready |
| New Supplier | ... | No Accreditation | 0 | 0 | 0 | 0 | 0 | Not accredited |

- **Goods ✓** column header is in **blue**.
- **Services ✓** column header is in **purple**.
- Numbers in the Goods ✓ column are blue; Services ✓ numbers are purple.

**Card view (mobile):**
- "Verified Goods" label with a blue count.
- "Verified Services" label with a purple count.

**Badge pills (visible on both views):**
- A supplier with 3 verified goods shows: **"3 Verified Goods"** (blue badge).
- A supplier with 2 verified services shows: **"2 Verified Services"** (purple badge).
- A supplier with both shows both badges.
- A supplier with nothing shows: **"No Verified Products"** (neutral badge).

---

### Step 3 — Select and Assign Suppliers

1. Check the checkboxes for the suppliers you want.
2. Click **"Assign (N)"**.
3. Suppliers are added to the RFQ.

---

## Journey 6: Supplier Submits a Quotation for a Services RFQ

**Who:** Supplier user  
**Starting point:** Supplier has been assigned to an RFQ where the PR1 is of type `request_type = 'services'`

---

### Step 1 — Open the Quotation

1. Log in as supplier.
2. Go to **RFQ Inbox** → click on the RFQ.
3. You land on `/supplier/quotations/{rfqSupplierId}`.

---

### Step 2 — What You See Differently (vs. a Goods RFQ)

**Sidebar:**
- Under catalog summary: **"Catalog Services"** (not "Catalog Products").
- Count text: "2 service offerings available · all verified".

**Per-line mode tabs:**
- **"Select Catalog Service"** (not "Select Catalog Product").
- **"Manual Entry"** — same as before.
- **"Propose New Service"** (not "Propose New Product").
- **"No Quote"** — same as before.

---

### Step 3 — Select from Catalog

1. Click **"Select Catalog Service"** tab.
2. Click **"Choose Catalog Service"** button.

**Picker dialog opens:**
- Title: **"Select Catalog Service"**
- Description: *"Choose a verified or in-flight service offering from your catalog…"*
- Table lists your catalog services with status (Verified / Pending review / etc.)

3. Click **"Select"** on "Annual HVAC Maintenance".
4. Dialog closes. The line shows the selected service with its verification status.

---

### Step 4 — Fill in Price and Timeline

**Fields shown:**
- **"Quoted Service / Description"** (not "Quoted Item / Specification") — pre-filled with service name.
- **Unit Price (₱)** — same as before.
- **"Delivery Timeline (days)"** (not "Lead Time (days)") — enter number of days.

1. Quoted Service / Description: `Annual HVAC Maintenance — Full Service`
2. Unit Price: `₱15,000.00`
3. Delivery Timeline: `7` (days to mobilize / start)
4. Remarks: `Includes annual service report. Parts warranty 6 months.`

---

### Step 5 — Propose a New Service (alternative flow)

If no catalog service matches:
1. Click **"Propose New Service"** tab.
2. A form opens:
   - **Service Name \*** (not "Product Name")
   - **No Product Code field**
   - **Category (optional)** — placeholder: "e.g. Maintenance, Consulting, IT Services"
   - **Scope of Service (optional)** — placeholder: "Describe what is included in this service offering"
   - **Terms & Conditions / SLA (optional)** — placeholder: "SLA, billing model, response time, coverage period..."
3. Fill in and click **"Submit Proposal"**.
4. Service is created in your catalog (status: Submitted) and linked to this quote line.

---

### Step 6 — Submit the Quotation

1. All lines have a price and timeline.
2. Click **"Submit Quotation"**.
3. Success banner: "Quotation submitted successfully. You can update your prices and resubmit before the deadline."

---

## Journey 7: Full End-to-End — Services Procurement Cycle

This journey strings everything together.

---

### Stage A: Supplier Registers a Service

1. Supplier → `/supplier/products/new` → clicks "Services".
2. Fills: "Office Pest Control Service", Category: "Sanitation".
3. Saves as draft → sees purple "Services" badge, no product code.
4. Uploads company certification PDF → "Supporting Documents".
5. Clicks "Submit for Review" → status: Submitted.

---

### Stage B: Procurement Verifies the Service

1. Procurement → `/accreditation/products/{id}`.
2. Sees purple "Services" badge, no RSE button, "Supporting Documents".
3. Reviews the uploaded certification.
4. Clicks "Verify Directly" → reads service-specific description.
5. Confirms → status: Verified, Can Offer = Yes.

---

### Stage C: PR1 for Services is Created

1. Requester creates a PR1 with Request Type = **Services**.
2. PR1 goes through approval → reaches "For Canvassing" status.

---

### Stage D: Procurement Creates an RFQ

1. Procurement creates RFQ from the services PR1.
2. Opens **Assign Suppliers** modal.
3. Sees "Goods ✓" / "Services ✓" split counts for each supplier.
4. Identifies a supplier with **Services ✓ = 1** (the one who registered the pest control service).
5. Assigns that supplier → clicks "Assign".

---

### Stage E: Supplier Quotes for the Service

1. Supplier receives RFQ notification.
2. Goes to `/supplier/quotations/{rfqSupplierId}`.
3. Sees service-aware labels throughout.
4. Clicks "Select Catalog Service" → picker shows "Office Pest Control Service" (Verified).
5. Selects it → fills Unit Price: ₱8,500.00, Delivery Timeline: 3 days.
6. Submits quotation.

---

### Stage F: Procurement Reviews Quotes and Awards

1. Procurement goes to `/rfq/{id}` → quote comparison matrix.
2. Sees the service product linked to the supplier's quote cell.
3. Awards the line to the supplier.
4. Proceeds with PO creation.

---

## Summary of What Changed Per Screen

| Screen | URL | What's new |
|--------|-----|------------|
| Add Product | `/supplier/products/new` | Goods/Services toggle; service hides product code, changes all labels |
| Product Detail | `/supplier/products/{id}` | Purple badge, service labels, no RSE section for services |
| Product Catalog List | `/supplier/products` | Type column with badges; Type filter (Goods/Services/All) |
| Accreditation Review | `/accreditation/products/{id}` | Purple/blue badge in header; no RSE button for services; service-specific verify text; "Supporting Documents" heading |
| Assign Suppliers Modal | RFQ page modal | "Goods ✓" + "Services ✓" columns replace single "Verified" column; specific count badges |
| Supplier Quotation | `/supplier/quotations/{id}` | Service-aware mode tab labels; "Delivery Timeline"; "Quoted Service / Description"; service propose form |
