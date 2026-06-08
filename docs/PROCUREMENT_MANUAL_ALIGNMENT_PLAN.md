# Procurement Manual Alignment Plan

## Executive Summary

The **Employee** section (1.x) of the Word manual (`Procurement Documentation (User Manual).docx`) is well-structured with the proper instructional template. However, **Procurement** (3.x) and **Approver** (4.x) sections are caption-only, lacking the depth needed for user training.

## Problem Statement

### Current State (Caption-Only Format)
The Procurement and Approver sections look like this:

```
3.8 Product Review (/accreditation/products)

Caption: Product Review List - Lists product catalog items submitted by suppliers...

Caption: Product Review Detail - Displays product specifications...
```

### Issues with Caption-Only
- **No instructional value**: Users can't operate the system from captions alone
- **No workflow guidance**: Missing step-by-step task completion instructions
- **No decision support**: When to choose "Verify" vs "Create RSE" vs "Reject" is unclear
- **No context**: Why am I on this page? What happens after I click?

## Target Template (Employee Section Format)

Every screen should follow this structure:

```markdown
### Module Purpose
Business reason — one sentence

### Module UI Map
Table: element → what it does

### Step-by-Step Workflows
#### Workflow 1: [Task Name]
- Step 1: [Action] → Expected Result: [Outcome]
- Step 2: [Action] → Expected Result: [Outcome]

#### Workflow 2: [Alternative Task]
...

### Status Glossary
Badge meanings specific to this screen

### Notes & Tips
Warnings, shortcuts, best practices

### Expected Outcome
What should happen after success

[Screenshot Caption]
*Figure X: Visual confirmation only*
```

## Sections Requiring Alignment

### Priority 1: Procurement (19 screens) — 0% aligned
- 3.1 Dashboard (1 screen)
- 3.2 PR2 Requests (1 screen)
- 3.3 Canvassing / RFQ (2 screens: queue + bid comparison)
- 3.4 Purchase Orders (2 screens: list + generate PO)
- 3.5 Delivery Tracking (2 screens)
- 3.6 Goods Receipt (2 screens)
- 3.7 Supplier Accreditation (1 screen)
- **3.8 Product Review (2 screens: list + detail) ← START HERE**
- 3.9 Approval Queue & History (2 screens)
- 3.10 Utilities (4 screens: Messages, Profile, Bug ×2)

### Priority 2: Approver (19 screens) — 0% aligned
- 4.1 Dashboard
- 4.2 PR1 Approvals (4 screens)
- 4.3 PR2 Approvals (4 screens)
- 4.4 PO Approvals (3 screens)
- 4.5 Unified Approval Queue
- 4.6 Approval History (2 screens)
- 4.7 Utilities (4 screens)

### Priority 3: Warehouse (6 screens) — 15% aligned
- 2.2-2.7: Most screens have UI maps but missing workflows/outcomes

### Priority 4: Polish
- TSQA (3 screens) — Add outcomes & glossaries
- Employee utilities (1.9-1.11) — Low priority
- Supplier utilities (5.7-5.9) — Low priority

## Example: Product Review Section (Before → After)

### Before (Caption-Only) ❌
```
3.8 Product Review (/accreditation/products)

Caption: Product Review List - Lists product catalog items submitted by suppliers. It displays verification status badges (Pending, Under TSQA, Verified, Rejected) and options to review detail pages.

Caption: Product Review Detail - Displays product specifications. Procurement officers can verify products directly (making them eligible for RFQs), reject them, or click 'Create RSE' to route raw materials to the TSQA team.
```

### After (Employee-Aligned) ✅
```markdown
### 3.8.1 Product Review List (`/accreditation/products`)

#### Module Purpose
Lists supplier product submissions awaiting procurement verification. Products must be verified before they can be awarded on RFQs.

#### Module UI Map
| Element | Description |
|---------|-------------|
| Status Tabs | Pending / Under TSQA / Verified / Rejected / All |
| SEARCH | Filter by product name, supplier, code, or category |
| Apply / Clear All | Execute or reset filters |
| Product Table | Columns: PRODUCT (name + badge), SUPPLIER, STATUS, SUBMITTED DATE |
| Review → | Opens product detail page |

#### Step-by-Step Workflows

##### Workflow 1: Finding Pending Products
1. Navigate to **Product Review** from the sidebar.
2. Click the **Pending** tab to filter unreviewed submissions.
3. **Expected Result**: Table shows products with status = Submitted or Under Review.

##### Workflow 2: Opening Product Details
1. From the Product Review list, click **Review →** on any product row.
2. **Expected Result**: Product detail page opens showing specifications and documents.

#### Status Glossary
| Badge | Meaning |
|-------|---------|
| Submitted | Awaiting your first action |
| Under Review | You are actively evaluating |
| Under TSQA | Routed to scientific review |
| Verified | Can be awarded on RFQs |
| Rejected | Not usable; supplier must resubmit |

#### Notes & Tips
- Use the search box to find specific suppliers or product codes quickly
- Products with status "Under TSQA" are pending laboratory evaluation — do not verify directly

#### Expected Outcome
Product queue loaded; ready to review individual submissions.

**Figure 3.8.1:** Product Review List — Status tabs, search filters, and product directory.

---

### 3.8.2 Product Review Detail (`/accreditation/products/{id}`)

#### Module Purpose
Review a supplier product submission and decide whether it can be used in RFQs: verify directly, route to TSQA via RSE, or reject.

#### Module UI Map
| Element | Action |
|---------|--------|
| Product Catalog Record | Read code, category, description, specifications |
| Product Documents | Review supplier-uploaded compliance files |
| Mark Under Review | Sets status to `under_review` — start evaluation |
| Verify Directly | Sets status to `verified` — product can be awarded on RFQs |
| Reject | Sets status to `rejected` — requires remarks; supplier notified |
| Create RSE for TSQA | Creates RSE; product → `pending_tsqa`; TSQA evaluates |

#### Step-by-Step Workflows

##### Workflow 1: Verify a Standard Product
1. Open **Product Review** → **Pending** tab → click **Review** on the product.
2. Read specifications and open attached documents.
3. Click **Mark Under Review** (optional but recommended).
4. If specs and documents are acceptable, click **Verify Directly**.
5. **Expected Result**: Status = Verified; product eligible for RFQ award.

##### Workflow 2: Route Raw Material to TSQA
1. From the same detail page, click **Create RSE for TSQA**.
2. Assign a TSQA reviewer if prompted.
3. **Expected Result**: Product status = Pending TSQA; TSQA receives notification.
4. Wait for TSQA Pass/Fail before awarding on RFQs.

##### Workflow 3: Reject a Product
1. Click **Reject**.
2. Enter mandatory remarks explaining the deficiency.
3. **Expected Result**: Status = Rejected; supplier notified to revise or withdraw.

#### Decision Guide
| Situation | Action |
|-----------|--------|
| Standard consumable, docs complete | Verify Directly |
| Raw material / needs lab testing | Create RSE for TSQA |
| Missing specs, wrong category, non-compliant docs | Reject |

#### Status Glossary
| Badge | Meaning |
|-------|---------|
| Submitted | Awaiting your first action |
| Under Review | You are actively evaluating |
| Pending TSQA | Routed to scientific review |
| Verified | Can be awarded on RFQs |
| Rejected | Not usable; supplier must resubmit |

#### Notes & Tips
- **Always review documents** before verifying — missing compliance certificates should trigger rejection
- **Raw materials require TSQA** — Do not verify chemical products or materials requiring lab testing
- **Remarks are mandatory** when rejecting — be specific so suppliers can correct issues

#### Expected Outcome
Product verification decision recorded; status updated; notifications sent to supplier and/or TSQA.

**Figure 3.8.2:** Product Review Detail — product specifications panel, document list, and action buttons (Verify, Reject, Create RSE).
```

## Data Sources for Accurate Workflows

When rewriting sections, pull workflow details from:

1. **`procurement_manual.md`** — Already aligned, detailed workflows
2. **`A-Fortune-Procurement-System-User-Manual.md`** — Role-based task instructions
3. **Employee sections (1.x)** — Template structure reference
4. **Audit documents** in `docs/` — Verify UI states and button labels

## Execution Plan

### Phase 1: Procurement Role (Pilot)
- Start with **3.8 Product Review** (2 screens) as proof of concept
- Validate with user before continuing
- Roll through 3.1-3.10 (17 remaining screens)

### Phase 2: Approver Role
- Apply same template to 4.1-4.7 (19 screens)

### Phase 3: Polish
- Warehouse utilities (2.5-2.7)
- TSQA outcomes (6.1-6.3)
- Employee utilities (1.9-1.11)

## Success Criteria

✅ Every operational screen has:
- Module Purpose (why this exists)
- UI Map (what to click)
- At least one Step-by-Step Workflow (how to complete a task)
- Expected Outcome (what should happen)
- Status Glossary (badge meanings, if applicable)

✅ Screenshots demoted to supporting figures with simple captions

✅ Consistency across all roles (Employee, Warehouse, Procurement, Approver, Supplier, TSQA, Admin)

## Next Step

**Recommend**: Rewrite **Procurement 3.8 Product Review** (list + detail, 2 screens) using the "After" example above, then validate with user before proceeding to remaining 17 Procurement screens.

---

**Prepared for**: Procurement Manual Alignment Project  
**Based on**: Conversation analysis comparing Employee vs Procurement section structures  
**Reference**: `docs/Procurement Documentation (User Manual).docx` (text extraction)
