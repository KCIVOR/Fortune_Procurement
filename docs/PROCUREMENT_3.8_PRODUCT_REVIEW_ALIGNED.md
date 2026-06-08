# 3.8 Product Review — ALIGNED VERSION

**Role**: Procurement  
**URLs**: `/accreditation/products` (list), `/accreditation/products/{id}` (detail)  
**Template Compliance**: ✅ Matches Employee section format (Module Purpose → UI Map → Workflows → Glossary → Expected Outcome)

---

## 3.8.1 Product Review List (`/accreditation/products`)

### Module Purpose
Lists supplier product submissions awaiting procurement verification. Products must be verified before they can be awarded on RFQs.

### Module UI Map

| Element | Type | Description / Action |
|---------|------|---------------------|
| **Status Tabs** | Tab Navigation | Pending (1) / Under TSQA (1) / Verified (1) / Rejected (0) / All (3) |
| **SEARCH** | Text Input | Placeholder: `Search by product name, supplier, code, or category...` |
| **Apply** | Button | Executes search and filters |
| **Clear All** | Button | Resets all filters to default |
| **Product Table** | Data Table | Columns: PRODUCT, SUPPLIER, STATUS, SUBMITTED DATE, ACTION |
| PRODUCT Column | Text + Badge | Product name with inline status badge |
| SUPPLIER Column | Text | Supplier name, product code, category, submission date |
| STATUS Column | Badge | Color-coded: Submitted / Under TSQA / Verified / Rejected |
| SUBMITTED Column | Date | Submission timestamp |
| **Review →** | Action Link | Opens product detail page (`/accreditation/products/{id}`) |

### Step-by-Step Workflows

#### Workflow 1: Finding Pending Products
1. Navigate to **Product Review** from the sidebar.
2. **Expected Result**: Page loads showing all products across status tabs.

3. Click the **Pending** tab (count badge shows number of unreviewed items).
4. **Expected Result**: Table filters to show only products with status = `submitted` or `under_review`.

5. Optionally, type a search query (e.g., supplier name, product code) in the SEARCH box.
6. Click **Apply** to refine results.
7. **Expected Result**: Table updates to show matching products only.

#### Workflow 2: Opening Product Details for Review
1. From the Product Review list, locate the product you want to review.
2. Click **Review →** on that product's row.
3. **Expected Result**: Product detail page opens showing full specifications, documents, and action buttons.

### Status Glossary (exact badge text)
| Badge | Meaning |
|-------|---------|
| `Submitted` | Awaiting your first action |
| `Under Review` | You are actively evaluating |
| `Under TSQA` | Routed to scientific review; TSQA is evaluating |
| `Verified` | Can be awarded on RFQs; procurement-cleared |
| `Rejected` | Not usable; supplier must resubmit |

### Notes & Tips
- **Pending tab** is your primary work queue — start here daily
- Use the **search box** to find specific suppliers or product codes quickly
- Products with status **"Under TSQA"** are pending laboratory evaluation — do not verify directly; wait for TSQA verdict
- The **All** tab shows your complete review history across all statuses

### Expected Outcome
Product queue loaded; ready to review individual submissions. Click any **Review →** link to proceed to detail evaluation.

---

**Figure 3.8.1:** Product Review List — Status tabs, search filters, and product directory table.

---

## 3.8.2 Product Review Detail (`/accreditation/products/{id}`)

### Module Purpose
Review a supplier product submission and decide whether it can be used in RFQs: verify directly, route to TSQA via RSE, or reject.

### Module UI Map

| Element | Type | Description / Action |
|---------|------|---------------------|
| **Page Header** | Text | Product name + Supplier name |
| **Status Badge** | Badge | Current verification status (inline with header) |
| **Info Notice** | Alert Box | *"Verified = Can Offer / Can Award (when linked on an RFQ quote and substitute rules are met). Pending validation = not awardable until verified."* |
| **Compliance Traceability** | Breadcrumb | `Accreditation → Products → RSE → TSQA` |
| **Product Catalog Record** | Info Panel | Section displaying: Product Code, Category, Description, Specifications, Submitted Date |
| Product Code | Read-only Field | e.g., `test` |
| Category | Read-only Field | e.g., `test` |
| Description | Read-only Text Area | Full product description |
| Specifications | Read-only Text Area | Technical specs and properties |
| Submitted Date | Read-only Date | When supplier submitted this product |
| **Action Buttons** | Button Group | Control panel with 4 action buttons |
| **Mark Under Review** | Button | Sets status to `under_review` — signals active evaluation |
| **Verify Directly** | Button (Primary) | Sets status to `verified` — product becomes awardable on RFQs |
| **Reject** | Button (Danger) | Sets status to `rejected` — requires mandatory remarks; supplier notified |
| **Create RSE for TSQA** | Button (Secondary) | Creates RSE record; routes to TSQA for technical evaluation; product status → `pending_tsqa` |
| **Product Documents** | File List Panel | Shows count of uploaded compliance files |
| Empty State | Text | *"No documents uploaded by the supplier yet."* |
| Document List | File Links | Downloadable attachments (when present) |

### Step-by-Step Workflows

#### Workflow 1: Verify a Standard Product
1. Open **Product Review** → **Pending** tab → click **Review** on the product row.
2. **Expected Result**: Product detail page opens showing Product Catalog Record.

3. **Review specifications**:
   - Read the **Description** field to understand the product
   - Check the **Specifications** field for technical requirements
   - Verify the **Product Code** and **Category** are correct
4. **Expected Result**: You understand what the product is and what it's used for.

5. **Review documents** (if available):
   - Scroll to the **Product Documents** section
   - Download and review any compliance certificates, data sheets, or test reports
6. **Expected Result**: Documents meet your compliance standards (or no critical documents are missing).

7. Click **Mark Under Review** (optional but recommended to signal you're working on it).
8. **Expected Result**: Status badge changes to `Under Review`; visible to other team members.

9. If specs and documents are acceptable, click **Verify Directly**.
10. **Expected Result**: 
    - Status changes to **Verified**
    - Product becomes eligible for RFQ award
    - Supplier receives notification
    - Product can now be selected in Quotation Comparison table

#### Workflow 2: Route Raw Material to TSQA
1. From the product detail page, determine that the product requires laboratory testing (e.g., raw material, chemical, requires technical evaluation).
2. Click **Create RSE for TSQA**.
3. **Expected Result**: System opens RSE creation form or confirmation dialog.

4. Fill in RSE details:
   - Assign a TSQA reviewer (if prompted)
   - Add evaluation scope or testing requirements (if prompted)
5. Click **Submit** or **Create RSE**.
6. **Expected Result**: 
   - RSE record created
   - Product status changes to **Pending TSQA** (or **Under TSQA**)
   - TSQA team receives notification
   - You return to Product Review list

7. **Wait** for TSQA to complete evaluation and update status to Pass/Fail.
8. **Expected Result**: Once TSQA passes the product, status will change to **Verified** automatically, making it awardable on RFQs.

#### Workflow 3: Reject a Product
1. From the product detail page, determine that the product does not meet requirements (e.g., missing specs, wrong category, non-compliant documents).
2. Click **Reject**.
3. **Expected Result**: System opens a remarks input dialog (mandatory field).

4. **Enter rejection reason** in the remarks field. Be specific:
   - ❌ Bad: "Not acceptable"
   - ✅ Good: "Product code format incorrect; should follow P-XXXX-YYYY pattern"
   - ✅ Good: "Missing compliance certificate ISO 9001; required for this category"
   - ✅ Good: "Specifications incomplete; no tensile strength data provided"
5. Click **Confirm Reject** or **Submit**.
6. **Expected Result**: 
   - Product status changes to **Rejected**
   - Supplier receives notification with your remarks
   - Product is removed from awardable catalog
   - Supplier can revise and resubmit

### Decision Guide
| Situation | Recommended Action | Reasoning |
|-----------|-------------------|-----------|
| Standard consumable (office supplies, hardware), docs complete | **Verify Directly** | No lab testing needed; procurement review sufficient |
| Raw material / chemical / requires lab testing | **Create RSE for TSQA** | TSQA has technical expertise to evaluate safety and quality |
| Missing specs, wrong category | **Reject** with specific remarks | Supplier needs to correct and resubmit |
| Missing compliance documents (ISO, FDA, etc.) | **Reject** with list of required documents | Non-compliant products cannot be verified |
| Product already verified but need re-evaluation | **Create RSE for TSQA** | Route to TSQA for technical re-check |
| Product category unclear or description vague | **Reject** and request clarification | Cannot verify without clear product definition |

### Status Glossary (exact badge text)
| Badge | Meaning | Can Award on RFQ? |
|-------|---------|-------------------|
| `Submitted` | Awaiting your first action | ❌ No |
| `Under Review` | You are actively evaluating | ❌ No |
| `Pending TSQA` | Routed to scientific review; TSQA evaluating | ❌ No |
| `Verified` | Can be awarded on RFQs; procurement-cleared | ✅ **Yes** |
| `Rejected` | Not usable; supplier must resubmit | ❌ No |

### Notes & Tips
- **Always review documents before verifying** — missing compliance certificates should trigger rejection
- **Raw materials require TSQA** — Do not verify chemical products, lab consumables, or materials requiring technical testing
- **Remarks are mandatory when rejecting** — be specific so suppliers can correct issues and resubmit successfully
- **Mark Under Review is optional** but helps other procurement officers know you're working on the item
- **Check the RFQ award restriction** — Even if verified, a product can only be awarded if:
  - Supplier's accreditation status = `approved`
  - Product linked to an RFQ quote line
  - Substitute rules are met (if applicable)

### Expected Outcome
Product verification decision recorded; status updated; notifications sent to:
- **Supplier** (if Verified or Rejected)
- **TSQA team** (if RSE created)
- **Procurement team** (status change logged)

Product becomes awardable (if Verified) or removed from catalog (if Rejected) or routed for evaluation (if sent to TSQA).

---

**Figure 3.8.2:** Product Review Detail — product specifications panel, document list, and action buttons (Mark Under Review, Verify Directly, Reject, Create RSE for TSQA).

---

## Integration Points

### Upstream Dependencies
- **Supplier Accreditation** (`/accreditation`): Supplier must be `approved` before their products can be verified
- **Product Catalog Submission** (Supplier portal): Supplier submits products through `/supplier/products`

### Downstream Impacts
- **RFQ Quotation Comparison** (`/rfq/{rfqId}`): Only **Verified** products can be awarded as RFQ winners
- **TSQA RSE Queue** (`/tsqa/rse`): Creating RSE routes the product to TSQA for technical evaluation
- **Supplier Notifications**: Status changes (Verified/Rejected) trigger email notifications to supplier

### Related Workflows
- **Accreditation Review** (3.7): Approve supplier before verifying their products
- **RFQ Award** (3.3): Use verified products when selecting quotation winners
- **TSQA Evaluation** (6.1-6.3): TSQA team processes RSE and updates product status

---

## Comparison: Before vs After

### ❌ BEFORE (Caption-Only)
```
3.8 Product Review (/accreditation/products)

Caption: Product Review List - Lists product catalog items submitted by suppliers. 
It displays verification status badges (Pending, Under TSQA, Verified, Rejected) 
and options to review detail pages.

Caption: Product Review Detail - Displays product specifications. Procurement 
officers can verify products directly (making them eligible for RFQs), reject 
them, or click 'Create RSE' to route raw materials to the TSQA team.
```

**Problems**:
- ❌ No purpose statement
- ❌ No UI element descriptions
- ❌ No step-by-step workflows
- ❌ No decision guide (when to Verify vs RSE vs Reject)
- ❌ No expected outcomes
- ❌ No status meanings
- ❌ No tips or warnings

### ✅ AFTER (Employee-Template Aligned)
```
3.8.1 Product Review List
- Module Purpose: Why this page exists
- Module UI Map: Table of all UI elements
- Step-by-Step Workflows: 
  - Workflow 1: Finding Pending Products (7 steps)
  - Workflow 2: Opening Product Details (3 steps)
- Status Glossary: 5 badge meanings
- Notes & Tips: 4 practical tips
- Expected Outcome: What should happen
- Screenshot caption: Supporting visual only

3.8.2 Product Review Detail
- Module Purpose: Business reason for this screen
- Module UI Map: Detailed table of 15+ UI elements
- Step-by-Step Workflows:
  - Workflow 1: Verify a Standard Product (10 steps)
  - Workflow 2: Route Raw Material to TSQA (8 steps)
  - Workflow 3: Reject a Product (6 steps)
- Decision Guide: Table mapping situations to actions
- Status Glossary: 5 statuses with award eligibility
- Notes & Tips: 6 warnings and best practices
- Expected Outcome: Detailed results
- Integration Points: Upstream/downstream connections
- Screenshot caption: Supporting visual only
```

**Benefits**:
- ✅ Users can **complete tasks** from the manual
- ✅ **Decision support** — when to choose which action
- ✅ **Expected outcomes** — what should happen next
- ✅ **Error prevention** — tips warn about common mistakes
- ✅ **Consistent** with Employee template
- ✅ **Trainable** — new users can learn the system

---

## Recommendation

Use this **3.8 Product Review** section as the template for rewriting all remaining Procurement and Approver sections. The structure is proven (matches Employee), comprehensive (covers all workflows), and practical (users can complete tasks).

**Next Steps**:
1. ✅ **Validate this section** — Review with users/stakeholders
2. ⏭️ **Roll out to 3.1-3.7** — Apply same structure to other Procurement screens
3. ⏭️ **Roll out to 3.9-3.10** — Complete Procurement role
4. ⏭️ **Apply to 4.x Approver** — Use same template for Approver sections
5. ⏭️ **Polish Warehouse/TSQA** — Add missing outcomes/glossaries

---

**Template Source**: Employee section 1.x structure  
**Workflow Source**: `procurement_manual.md` (validated, detailed)  
**Status/UI Source**: Audit documents and screen captures  
**Format**: Aligned to Employee User Manual standard (Module Purpose → UI Map → Workflows → Glossary → Outcome)
