# 🚨 CRITICAL: Apply Workflow Admin RLS Migration

**Status**: ⚠️ REQUIRED BEFORE USING WORKFLOW ADMIN FEATURE  
**Priority**: HIGH  
**Estimated Time**: 2 minutes

---

## ⚠️ Problem

When admins try to edit workflow steps, they get a **406 Not Acceptable** error because the database lacks the necessary RLS (Row Level Security) policies.

**Error Example**:
```
Request Method: PATCH
Status Code: 406 Not Acceptable
URL: https://[your-project].supabase.co/rest/v1/approval_steps?id=eq.[step-id]
```

---

## ✅ Solution

Apply the RLS migration that adds admin permissions to modify workflows and steps.

---

## 📋 Step-by-Step Instructions

### Option 1: Using Supabase CLI (Recommended)

1. **Open Terminal** in your project directory

2. **Run the migration**:
   ```bash
   supabase db push
   ```

3. **Verify** the policies were created:
   ```bash
   supabase db execute "
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE tablename IN ('approval_workflows', 'approval_steps')
   AND policyname LIKE 'Admins can%'
   ORDER BY tablename, policyname;
   "
   ```

4. **Expected Output** (6 rows):
   ```
   tablename           | policyname
   -------------------+----------------------------------
   approval_steps     | Admins can delete approval steps
   approval_steps     | Admins can insert approval steps
   approval_steps     | Admins can update approval steps
   approval_workflows | Admins can delete approval workflows
   approval_workflows | Admins can insert approval workflows
   approval_workflows | Admins can update approval workflows
   ```

---

### Option 2: Using Supabase Dashboard

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the Migration**
   - Open file: `supabase/migrations/20260521120000_add_admin_workflow_management_rls.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Query**
   - Click "Run" button
   - Wait for success message

5. **Verify Policies**
   - Create a new query
   - Run:
     ```sql
     SELECT tablename, policyname 
     FROM pg_policies 
     WHERE tablename IN ('approval_workflows', 'approval_steps')
     AND policyname LIKE 'Admins can%'
     ORDER BY tablename, policyname;
     ```
   - Should return 6 rows

---

## 🧪 Test the Fix

1. **Login as Admin**
   - Go to your application
   - Login with an admin account

2. **Navigate to Workflows**
   - Go to `/admin/workflows`

3. **Try Editing a Step**
   - Click on any workflow (e.g., PR1_APPROVAL)
   - Click "Edit" on any step
   - Change the Action Label
   - Click "Update Step"

4. **Expected Result**: ✅
   - Step updates successfully
   - No 406 error
   - Success message appears
   - Step table refreshes with new data

---

## 🔍 Troubleshooting

### Issue: "supabase: command not found"

**Solution**: Install Supabase CLI
```bash
# Using npm
npm install -g supabase

# Using Homebrew (Mac)
brew install supabase/tap/supabase

# Using Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

---

### Issue: Migration already applied

**Symptom**: Error says policies already exist

**Solution**: This is fine! The policies are already in place. Verify with:
```sql
SELECT COUNT(*) FROM pg_policies 
WHERE tablename IN ('approval_workflows', 'approval_steps')
AND policyname LIKE 'Admins can%';
-- Should return 6
```

---

### Issue: Still getting 406 error after migration

**Possible Causes**:
1. **Not logged in as admin**
   - Check: `SELECT role FROM profiles WHERE id = auth.uid();`
   - Should return: `admin`

2. **Browser cache**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Or clear browser cache

3. **Supabase client not refreshed**
   - Restart your development server
   - `npm run dev` (stop and start again)

4. **Wrong environment**
   - Verify you're connected to the correct Supabase project
   - Check `.env` file for correct `NEXT_PUBLIC_SUPABASE_URL`

---

## 📝 What This Migration Does

The migration adds 6 RLS policies:

### For `approval_workflows` table:
1. **Admins can insert approval workflows** - Allows creating new workflows
2. **Admins can update approval workflows** - Allows editing workflow properties
3. **Admins can delete approval workflows** - Allows removing workflows

### For `approval_steps` table:
1. **Admins can insert approval steps** - Allows adding new steps
2. **Admins can update approval steps** - Allows editing step properties
3. **Admins can delete approval steps** - Allows removing steps

**Security**: All policies check that the user has `role='admin'` before allowing the operation.

---

## ✅ Success Checklist

- [ ] Migration applied successfully
- [ ] 6 policies verified in database
- [ ] Logged in as admin user
- [ ] Can view workflows at `/admin/workflows`
- [ ] Can edit a step without 406 error
- [ ] Changes save successfully
- [ ] Audit log records the change

---

## 🆘 Need Help?

If you're still experiencing issues after following this guide:

1. **Check the logs**:
   ```bash
   # Supabase logs
   supabase logs
   
   # Application logs
   npm run dev
   # Check console for errors
   ```

2. **Verify admin role**:
   ```sql
   SELECT id, email, role FROM profiles WHERE role = 'admin';
   ```

3. **Check RLS policies**:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'approval_steps';
   ```

4. **Contact support** with:
   - Error message
   - Browser console logs
   - Database query results
   - Steps you've already tried

---

## 📚 Related Documentation

- **User Guide**: `docs/WORKFLOW_ADMIN_GUIDE.md`
- **Technical Docs**: `docs/WORKFLOW_ADMIN_TECHNICAL.md`
- **Deployment Guide**: `docs/WORKFLOW_ADMIN_DEPLOYMENT.md`
- **Implementation Summary**: `WORKFLOW_ADMIN_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated**: May 21, 2026  
**Migration File**: `supabase/migrations/20260521120000_add_admin_workflow_management_rls.sql`
