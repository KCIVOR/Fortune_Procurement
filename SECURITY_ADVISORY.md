# Security Advisory - RLS Disabled on rfq_suppliers

## ⚠️ CRITICAL SECURITY ISSUE

**Table:** `public.rfq_suppliers`  
**Issue:** Row Level Security (RLS) is **DISABLED**  
**Risk Level:** **CRITICAL**  
**Impact:** This table is fully exposed to the `anon` and `authenticated` roles used by Supabase client libraries

---

## What This Means

Anyone with your Supabase `anon` key can:
- ✅ Read ALL rows in `rfq_suppliers` table
- ✅ Modify ANY row in `rfq_suppliers` table
- ✅ Delete ANY row in `rfq_suppliers` table
- ✅ Insert new rows without restrictions

This is a **data security vulnerability** that could allow:
- Unauthorized access to RFQ supplier information
- Data manipulation by malicious actors
- Data leakage to competitors or unauthorized users

---

## Why RLS is Disabled

Looking at your migrations, RLS was intentionally disabled on this table, likely because:
1. The table needs to be accessible by multiple roles (procurement, suppliers, approvers)
2. Complex join queries were causing RLS policy recursion issues
3. Temporary workaround during development

**Migration:** `20260424004126_fix_rfq_suppliers_fk_and_rfq_number.sql`

---

## Recommended Fix

### Option 1: Enable RLS with Proper Policies (Recommended)

```sql
-- Enable RLS
ALTER TABLE public.rfq_suppliers ENABLE ROW LEVEL SECURITY;

-- Policy 1: Procurement can view all RFQ suppliers
CREATE POLICY "Procurement can view all rfq_suppliers"
  ON public.rfq_suppliers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'procurement'
    )
  );

-- Policy 2: Suppliers can view their own RFQ invitations
CREATE POLICY "Suppliers can view their own rfq_suppliers"
  ON public.rfq_suppliers
  FOR SELECT
  TO authenticated
  USING (
    supplier_id IN (
      SELECT id FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'supplier'
    )
  );

-- Policy 3: Approvers can view RFQ suppliers for their approval queue
CREATE POLICY "Approvers can view rfq_suppliers in their queue"
  ON public.rfq_suppliers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'approver'
    )
    AND rfq_batch_id IN (
      SELECT rfq_batches.id
      FROM public.rfq_batches
      INNER JOIN public.pr2_requests ON rfq_batches.pr2_id = pr2_requests.id
      INNER JOIN public.approval_instances ON pr2_requests.id = approval_instances.document_id
      WHERE approval_instances.current_approver_id = auth.uid()
    )
  );

-- Policy 4: Procurement can insert/update RFQ suppliers
CREATE POLICY "Procurement can manage rfq_suppliers"
  ON public.rfq_suppliers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'procurement'
    )
  );

-- Policy 5: Suppliers can update their own quotation responses
CREATE POLICY "Suppliers can update their own rfq_suppliers"
  ON public.rfq_suppliers
  FOR UPDATE
  TO authenticated
  USING (
    supplier_id IN (
      SELECT id FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'supplier'
    )
  )
  WITH CHECK (
    supplier_id IN (
      SELECT id FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'supplier'
    )
  );
```

### Option 2: Use Service Role for Backend Operations

If RLS policies are too complex:
1. Keep RLS enabled with basic read policies
2. Use service role key for write operations in API routes
3. Implement authorization checks in API middleware

---

## How to Apply the Fix

### Step 1: Create Migration

```bash
# Create new migration file
supabase migration new enable_rfq_suppliers_rls
```

### Step 2: Add SQL from Option 1 above

Copy the SQL policies into the new migration file.

### Step 3: Test Locally

```bash
# Apply migration locally
supabase db reset

# Test with different user roles
# Verify procurement can see all
# Verify suppliers can only see their own
```

### Step 4: Apply to Production

```bash
# Push to production
supabase db push
```

---

## Verification

After applying the fix, verify RLS is enabled:

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'rfq_suppliers';
```

Should return `rowsecurity = true`

Check policies exist:

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'rfq_suppliers';
```

Should return 5 policies.

---

## Impact Assessment

**Current Risk:**
- 🔴 **HIGH** - Table is fully exposed to all authenticated users
- 🔴 **HIGH** - Suppliers can see competitors' RFQ invitations
- 🔴 **HIGH** - Unauthorized users can manipulate RFQ data

**After Fix:**
- 🟢 **LOW** - Only authorized roles can access data
- 🟢 **LOW** - Suppliers isolated to their own data
- 🟢 **LOW** - Write operations restricted to procurement

---

## Action Required

⚠️ **This should be fixed BEFORE production deployment**

1. Review the recommended policies above
2. Adjust policies to match your business rules
3. Create and apply the migration
4. Test thoroughly with different user roles
5. Verify RLS is enabled and working

---

**Priority:** 🔴 **CRITICAL**  
**Effort:** ~2 hours (policy design + testing)  
**Risk if not fixed:** Data breach, unauthorized access, data manipulation
