# RFQ Product Verification Rule - Audit & Analysis

**Date:** May 25, 2026  
**Auditor:** Kiro AI  
**Purpose:** Audit current product verification requirements for RFQ quotations

---

## 🎯 Current Rule (As Understood)

**Original Rule:**
> "For Request for Quotation (RFQ), suppliers can only offer products that are verified by TSQA/Procurement."

---

## 📋 Audit Findings

### 1. **Supplier Product Status Flow**

Based on database schema (`supplier_products` table):

```
Status Flow:
draft 
  → submitted 
    → under_review (Procurement reviewing)
      → pending_tsqa (Sent to TSQA for RSE)
        → verified ✅ (TSQA passed RSE)
        → rejected ❌ (TSQA failed RSE or Procurement rejected)
      → verified ✅ (Procurement approved directly, no TSQA needed)
      → rejected ❌ (Procurement rejected)
    → withdrawn (Supplier withdrew)
  → inactive (Deactivated)
```

**Key Statuses:**
- `verified` = Product approved by either TSQA (via RSE) OR Procurement (direct approval)
- `rejected` = Product rejected by either TSQA or Procurement
- `pending_tsqa` = Awaiting TSQA evaluation
- `under_review` = Procurement is reviewing
- `submitted` = Supplier submitted, awaiting review

---

### 2. **Current Implementation - What the Code Does**

#### **A. Supplier Quotation Submission**

**File:** `app/supplier/quotations/[rfqSupplierId]/page.tsx`

```typescript
// Line 152-153: Supplier can only select from VERIFIED products
getVerifiedProductsForCurrentSupplier(profile)
```

**File:** `lib/supplier-products.ts`

```typescript
// Line 437-446: Function filters ONLY verified products
export async function getVerifiedProductsForCurrentSupplier(
  profile: UserProfile
): Promise<SupplierProduct[]> {
  const { data, error } = await db
    .from('supplier_products')
    .select('*')
    .eq('supplier_id', profile.id)
    .eq('status', 'verified')  // ← ONLY verified products
    .order('verified_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

**Finding:** ✅ **Suppliers can ONLY select verified products when submitting RFQ quotations.**

---

#### **B. Procurement Selection Validation**

**File:** `lib/canvassing.ts`

```typescript
// Line 862-866: When procurement selects a quote, validates product is linked
if (!quote?.supplier_product_id) {
  throw new Error(
    'Cannot select quote: no verified catalog product is linked. ' +
    'Ask the supplier to resubmit their quotation with a product from their verified catalog.'
  );
}

// Line 882-886: Validates product status is 'verified'
if (product.status !== 'verified') {
  throw new Error(
    `Cannot select quote: linked supplier product is not verified (current status: ${product.status}).`
  );
}
```

**Finding:** ✅ **Procurement CANNOT select a quote unless the linked product is verified.**

---

#### **C. Database Migration Comments**

**File:** `supabase/migrations/20260507000400_add_supplier_product_id_to_rfq_item_quotes.sql`

```sql
-- Line 11: Comment explicitly states the rule
-- Only suppliers whose products are verified may appear in the selector (enforced at app layer).
```

**Finding:** ✅ **The rule is documented in the database migration.**

---

### 3. **Who Can Verify Products?**

#### **Option 1: Procurement Direct Verification**

**File:** `lib/supplier-products.ts`

```typescript
// Line 309-335: Procurement can verify products directly (no TSQA needed)
export async function procurementVerifyProduct(
  productId: string,
  profile: UserProfile
): Promise<void> {
  // ... validation ...
  
  const { error } = await db
    .from('supplier_products')
    .update({
      status:       'verified',  // ← Direct verification
      verified_at:  now,
      reviewed_by:  profile.id,
      updated_at:   now,
    })
    .eq('id', productId);
}
```

**Finding:** ✅ **Procurement can verify products directly without TSQA.**

---

#### **Option 2: TSQA Verification via RSE**

**File:** `lib/tsqa.ts`

```typescript
// Line 134-137: TSQA verifies products after RSE passes
const productUpdate =
  input.result === 'passed'
    ? { status: 'verified',  verified_at: now, updated_at: now }
    : { status: 'rejected',  rejected_at: now, updated_at: now };
```

**Finding:** ✅ **TSQA can verify products after RSE evaluation passes.**

---

### 4. **RLS Policy Enforcement**

**File:** `supabase/migrations/20260507000200_supplier_accreditation_schema.sql`

```sql
-- Line 92-93: Database constraint on supplier_products status
status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft','submitted','under_review','pending_tsqa','verified','rejected','inactive'))
```

**Finding:** ✅ **Database enforces valid status values at the schema level.**

---

### 5. **Compliance Dashboard Tracking**

**File:** `lib/compliance-dashboard.ts`

```typescript
// Line 13-15: Tracks RFQs with non-verified products
/** Distinct open RFQs where this supplier has at least one quote line linked to a non-verified product */
rfqsPendingProductValidation: number;

// Line 91: Filters for non-verified products in RFQs
.neq('status', 'verified');
```

**Finding:** ✅ **System tracks RFQs that have quotes with non-verified products.**

---

## 📊 Summary of Current Implementation

### ✅ **What IS Enforced:**

1. **Supplier UI:** Only shows verified products in the product picker
2. **Supplier Function:** `getVerifiedProductsForCurrentSupplier()` filters by `status = 'verified'`
3. **Procurement Validation:** Cannot select a quote unless product is verified
4. **Database Schema:** Status values are constrained
5. **Compliance Tracking:** System monitors non-verified products in RFQs

### ⚠️ **What is NOT Enforced:**

1. **Database RLS Policy:** No RLS policy prevents inserting `rfq_item_quotes` with non-verified products
2. **API Route Validation:** No server-side check in the quotation submission API
3. **Direct Database Insert:** Someone with database access could bypass the rule

---

## 🔍 Potential Loopholes

### **Loophole 1: Direct Database Manipulation**

**Scenario:**
```sql
-- Someone with database access could do this:
INSERT INTO rfq_item_quotes (
  rfq_supplier_id, 
  pr1_item_id, 
  supplier_product_id,  -- ← Could link to a non-verified product
  unit_price,
  ...
) VALUES (...);
```

**Risk Level:** LOW (requires database access)

**Current Mitigation:**
- Procurement validation catches this when trying to select the quote
- Compliance dashboard flags it

**Recommendation:** Add RLS policy or CHECK constraint

---

### **Loophole 2: Product Status Changes After Quote Submission**

**Scenario:**
1. Supplier submits quote with verified product (Product A)
2. Product A gets rejected later (status changes to 'rejected')
3. Quote still references Product A

**Risk Level:** MEDIUM

**Current Mitigation:**
- Procurement validation checks product status at selection time
- If product is no longer verified, selection fails

**Recommendation:** Add a trigger to flag quotes when linked product status changes

---

### **Loophole 3: Supplier Creates Product During RFQ**

**Scenario:**
1. Supplier receives RFQ invitation
2. Supplier creates NEW product (status = 'draft')
3. Supplier submits product for review
4. While product is 'under_review' or 'pending_tsqa', supplier cannot use it in quote
5. ✅ This is correctly blocked by the UI

**Risk Level:** NONE (correctly handled)

---

## 💡 Proposed Rule Changes (Discussion)

### **Option A: Keep Current Rule (Strict)**

**Rule:** Suppliers can ONLY offer verified products in RFQ quotations.

**Pros:**
- ✅ Ensures quality control
- ✅ Prevents unvetted products from entering procurement
- ✅ Clear audit trail (all products are pre-approved)
- ✅ Protects company from substandard products

**Cons:**
- ❌ Slows down RFQ process (must wait for verification)
- ❌ Supplier cannot offer new products quickly
- ❌ May miss good deals if product verification is slow
- ❌ Limits supplier flexibility

**When to use:** High-risk industries (medical, aerospace, food safety)

---

### **Option B: Allow Pending Products with Approval Workflow**

**Rule:** Suppliers can offer products in any status, but procurement can only SELECT quotes with verified products.

**Changes Needed:**
1. Remove the `status = 'verified'` filter in `getVerifiedProductsForCurrentSupplier()`
2. Allow suppliers to link products in 'submitted', 'under_review', or 'pending_tsqa' status
3. Keep the procurement validation (can only select verified products)
4. Add visual indicators in UI showing product status

**Pros:**
- ✅ Faster RFQ response (supplier can quote immediately)
- ✅ Procurement still has final control (can only select verified)
- ✅ Encourages suppliers to submit new products
- ✅ More competitive quotes (more options)

**Cons:**
- ⚠️ More quotes to review (including non-verified products)
- ⚠️ Potential confusion (why can't I select this quote?)
- ⚠️ Requires clear UI indicators

**When to use:** Lower-risk industries, fast-moving procurement

---

### **Option C: Two-Track System**

**Rule:** 
- **Track 1 (Fast):** Verified products can be quoted and selected immediately
- **Track 2 (Conditional):** Non-verified products can be quoted, but selection is conditional on verification

**Changes Needed:**
1. Allow suppliers to quote with any product status
2. Add "conditional selection" feature:
   - Procurement can "conditionally select" a quote with non-verified product
   - Selection triggers fast-track verification process
   - If product passes verification → PO is created
   - If product fails verification → Selection is cancelled, next best quote is selected
3. Add SLA for fast-track verification (e.g., 48 hours)

**Pros:**
- ✅ Best of both worlds (speed + quality control)
- ✅ Incentivizes suppliers to pre-verify products
- ✅ Allows emergency procurement with safeguards
- ✅ Clear process for both tracks

**Cons:**
- ⚠️ More complex workflow
- ⚠️ Requires fast-track verification process
- ⚠️ May create bottleneck at TSQA/Procurement

**When to use:** Organizations that need both speed and quality

---

### **Option D: Risk-Based Approach**

**Rule:** Verification requirement depends on product category and value.

**Categories:**
- **High-Risk:** Medical supplies, safety equipment, food → MUST be verified
- **Medium-Risk:** Electronics, machinery → Should be verified (warning if not)
- **Low-Risk:** Office supplies, consumables → No verification required

**Changes Needed:**
1. Add `risk_category` field to `supplier_products`
2. Add `requires_verification` boolean based on category
3. Modify validation logic to check risk category
4. Add override capability for procurement (with justification)

**Pros:**
- ✅ Balances risk and speed
- ✅ Focuses verification efforts on high-risk items
- ✅ Reduces verification backlog
- ✅ Flexible for different product types

**Cons:**
- ⚠️ Requires product categorization
- ⚠️ More complex rules
- ⚠️ Potential for miscategorization

**When to use:** Organizations with diverse product portfolios

---

## 🎯 Recommendations

### **For Single Company, Internal Use (Your Case):**

**Recommended:** **Option B (Allow Pending with Approval Workflow)**

**Reasoning:**
1. ✅ You're internal use only (not selling to external clients)
2. ✅ Procurement has final control (can only select verified)
3. ✅ Speeds up RFQ process significantly
4. ✅ Encourages suppliers to submit products for verification
5. ✅ Easy to implement (just remove one filter)

**Implementation:**
- **Phase 1 (Quick Win):** Remove `status = 'verified'` filter, keep procurement validation
- **Phase 2 (Polish):** Add status badges in UI ("Verified", "Pending Review", "Under TSQA")
- **Phase 3 (Optional):** Add fast-track verification for urgent RFQs

---

### **If You Want to Keep Current Rule:**

**Recommended:** **Add Database-Level Enforcement**

**Add RLS Policy:**
```sql
-- Prevent linking non-verified products in quotes
CREATE POLICY "rfq_quotes_verified_products_only"
ON rfq_item_quotes
FOR INSERT TO authenticated
WITH CHECK (
  supplier_product_id IS NULL  -- Allow no product link
  OR EXISTS (
    SELECT 1 FROM supplier_products
    WHERE id = supplier_product_id
    AND status = 'verified'
  )
);
```

**Add Trigger for Status Changes:**
```sql
-- Flag quotes when linked product status changes
CREATE OR REPLACE FUNCTION flag_quotes_on_product_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'verified' AND NEW.status != 'verified' THEN
    -- Log or notify that quotes using this product are now invalid
    INSERT INTO audit_logs (
      action, document_type, document_id, payload
    ) VALUES (
      'PRODUCT_STATUS_CHANGED',
      'SUPPLIER_PRODUCT',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'affected_quotes', (
          SELECT COUNT(*) FROM rfq_item_quotes
          WHERE supplier_product_id = NEW.id
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_status_change_audit
AFTER UPDATE ON supplier_products
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION flag_quotes_on_product_status_change();
```

---

## 📝 Questions to Answer Before Changing

1. **How often do suppliers need to quote with new (unverified) products?**
   - If rarely → Keep current rule
   - If frequently → Consider Option B

2. **How long does product verification take on average?**
   - If < 24 hours → Keep current rule
   - If > 3 days → Consider Option B or C

3. **What's the risk if a non-verified product is selected?**
   - If high (safety/compliance) → Keep current rule
   - If low (office supplies) → Consider Option B or D

4. **Do you have fast-track verification capability?**
   - If yes → Consider Option C
   - If no → Stick with A or B

5. **How many RFQs are delayed due to product verification?**
   - If none → Keep current rule
   - If many → Consider changing

---

## ✅ Current Rule Assessment

**Current Implementation:** ✅ **CORRECTLY ENFORCED**

**Enforcement Level:** **Application Layer (Strong)**
- UI prevents selection of non-verified products
- Procurement validation blocks selection
- Compliance tracking monitors violations

**Gaps:** **Database Layer (Weak)**
- No RLS policy prevents direct database manipulation
- No trigger to handle product status changes after quote submission

**Overall Grade:** **B+ (Good, but could be stronger)**

---

**Next Steps:**
1. Decide if you want to keep the current rule or change it
2. If keeping: Add database-level enforcement (RLS + triggers)
3. If changing: Choose which option (B, C, or D) and implement

---

**Created:** May 25, 2026  
**Status:** Audit Complete - Awaiting Decision  
**Recommendation:** Option B (Allow Pending with Approval Workflow) for internal use
