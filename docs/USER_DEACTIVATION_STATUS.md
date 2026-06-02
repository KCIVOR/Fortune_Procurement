# User Deactivation/Deletion - Current Status

**Date:** June 2, 2026  
**Question:** Can superadmin delete/deactivate user accounts?  
**Answer:** ❌ **NO - Feature not implemented**

---

## 🔍 Current State

### What Superadmin CAN Do:

✅ **View all users**
- Access `/admin/users` page
- See user list with filters
- Search by name, email, employee ID
- Filter by role and department

✅ **View user details**
- Access `/admin/users/[id]` page
- See profile ID, role, position, department
- View email and creation date

✅ **Edit user assignment**
- Change user's role
- Change user's position
- Change user's department
- Access via "Edit Assignment" button

✅ **Reset user password**
- Generate temporary password
- Send password reset email
- Access via "Reset Password" button

✅ **Create new users**
- Add new user to system
- Assign role, position, department
- Send invitation email

---

## ❌ What Superadmin CANNOT Do:

### Missing Features:

1. **❌ Deactivate/Disable User Account**
   - No "Deactivate" button
   - No `is_active` or `status` column in `profiles` table
   - User remains active indefinitely

2. **❌ Delete User Account**
   - No "Delete" button
   - No API endpoint for deletion
   - Cannot remove users from system

3. **❌ Suspend User Account**
   - No temporary suspension feature
   - No "Suspend until date" option

4. **❌ Reactivate Deactivated Users**
   - Feature doesn't exist (no deactivation exists)

5. **❌ View User Status**
   - No active/inactive indicator
   - No status badges
   - Cannot filter by status

---

## 📊 Database Schema

### Current `profiles` Table:
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role_id uuid REFERENCES roles(id),
  position_id uuid REFERENCES positions(id),
  department_id uuid REFERENCES departments(id),
  payment_terms TEXT,
  created_at timestamptz DEFAULT now()
);
```

### ❌ Missing Columns:
- `is_active` BOOLEAN - To track active/inactive status
- `deactivated_at` TIMESTAMPTZ - When user was deactivated
- `deactivated_by` UUID - Who deactivated the user
- `deactivation_reason` TEXT - Why user was deactivated
- `last_login_at` TIMESTAMPTZ - Track user activity

---

## 🎯 How User Deletion Works Currently

### Cascade Deletion:
Users are linked to `auth.users` table with `ON DELETE CASCADE`. If someone deletes from `auth.users`, the profile is automatically deleted.

### Issues with Direct Deletion:
- ❌ No audit trail
- ❌ No soft delete
- ❌ No way to restore
- ❌ Related records might break
- ❌ No notification to user

---

## 🚨 Related Systems Check

### Other Entities with Deactivation:

✅ **Departments** - Has deactivation
- File: `app/admin/departments/page.tsx`
- Function: `deactivateDepartment()`
- Checks user count before deactivation

✅ **Positions** - Has deactivation
- File: `app/admin/positions/page.tsx`
- Function: `deactivatePosition()`
- Checks user count and workflow usage

❌ **Users** - No deactivation implemented

---

## 💡 What Should Be Implemented

### Option 1: Soft Delete (Deactivation) - Recommended ✅

**Benefits:**
- User data preserved
- Can be reactivated
- Audit trail maintained
- Related records intact

**Implementation:**

#### 1. Add Status Column
```sql
-- Migration: Add status tracking to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Index for filtering active/inactive users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
```

#### 2. Update RLS Policies
```sql
-- Users can only read their own profile if active
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id AND is_active = true);

-- Admins can see all profiles (active and inactive)
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role_id IN (SELECT id FROM roles WHERE name = 'admin')
    )
  );
```

#### 3. Create Deactivation Function
```typescript
// lib/admin-users.ts
export async function deactivateUser(
  userId: string,
  deactivatedBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user is already deactivated
    const { data: existingUser } = await db
      .from('profiles')
      .select('is_active')
      .eq('id', userId)
      .single();
    
    if (!existingUser?.is_active) {
      return { success: false, error: 'User is already deactivated' };
    }
    
    // Check if user has active sessions/assignments
    // (Add your business logic here)
    
    // Deactivate user
    const { error } = await db
      .from('profiles')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: deactivatedBy,
        deactivation_reason: reason
      })
      .eq('id', userId);
    
    if (error) throw error;
    
    // Log audit trail
    await logAudit({
      actor_id: deactivatedBy,
      action: 'user_deactivated',
      resource_type: 'user',
      resource_id: userId,
      details: { reason }
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function reactivateUser(
  userId: string,
  reactivatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await db
      .from('profiles')
      .update({
        is_active: true,
        deactivated_at: null,
        deactivated_by: null,
        deactivation_reason: null
      })
      .eq('id', userId);
    
    if (error) throw error;
    
    // Log audit trail
    await logAudit({
      actor_id: reactivatedBy,
      action: 'user_reactivated',
      resource_type: 'user',
      resource_id: userId
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

#### 4. Update UI Components

**UserDetail.tsx - Add Deactivate Button:**
```tsx
{isAdmin && user.is_active && (
  <Button
    onClick={() => setIsDeactivateModalOpen(true)}
    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm"
  >
    <UserX className="w-4 h-4 mr-2" />
    Deactivate User
  </Button>
)}

{isAdmin && !user.is_active && (
  <Button
    onClick={() => handleReactivate()}
    className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-sm"
  >
    <UserCheck className="w-4 h-4 mr-2" />
    Reactivate User
  </Button>
)}
```

**Add Status Badge:**
```tsx
{!user.is_active && (
  <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
    Deactivated
  </span>
)}
```

#### 5. Create Deactivation Modal
```tsx
// components/admin/DeactivateUserModal.tsx
interface DeactivateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onDeactivated: () => void;
}

export default function DeactivateUserModal({
  isOpen,
  onClose,
  userId,
  userName,
  onDeactivated
}: DeactivateUserModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleDeactivate = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for deactivation');
      return;
    }
    
    setIsSubmitting(true);
    const result = await deactivateUser(userId, profile.id, reason);
    setIsSubmitting(false);
    
    if (result.success) {
      toast.success('User deactivated successfully');
      onDeactivated();
      onClose();
    } else {
      toast.error(result.error || 'Failed to deactivate user');
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate User</DialogTitle>
          <DialogDescription>
            Are you sure you want to deactivate <strong>{userName}</strong>?
            They will no longer be able to log in to the system.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Reason for Deactivation *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Employee resigned, contract ended, policy violation..."
              rows={4}
              className="w-full mt-1 px-3 py-2 border rounded-md"
            />
          </div>
          
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> Deactivating a user will:
            </p>
            <ul className="text-xs text-amber-700 mt-1 ml-4 list-disc">
              <li>Prevent them from logging in</li>
              <li>Keep their data and history intact</li>
              <li>Allow reactivation if needed</li>
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleDeactivate}
            disabled={isSubmitting || !reason.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting ? 'Deactivating...' : 'Deactivate User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Option 2: Hard Delete (Permanent Deletion) - Not Recommended ⚠️

**Issues:**
- Data loss
- Cannot restore
- Breaks audit trail
- May break related records
- Compliance issues

**If Still Needed:**
```typescript
export async function deleteUser(
  userId: string,
  deletedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Log before deletion (for audit trail)
    await logAudit({
      actor_id: deletedBy,
      action: 'user_deleted',
      resource_type: 'user',
      resource_id: userId
    });
    
    // Delete from auth.users (cascades to profiles)
    const { error } = await admin.auth.admin.deleteUser(userId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

---

## 📋 Implementation Checklist

To add user deactivation feature:

- [ ] Create database migration (add status columns)
- [ ] Update RLS policies
- [ ] Create `deactivateUser()` function
- [ ] Create `reactivateUser()` function
- [ ] Create `DeactivateUserModal` component
- [ ] Update `UserDetail` component (add buttons)
- [ ] Update `UserTable` component (add status badge)
- [ ] Update `listAdminUsersWithCount()` to include status
- [ ] Add filter for active/inactive users
- [ ] Update login logic to check `is_active`
- [ ] Add audit logging
- [ ] Test deactivation flow
- [ ] Test reactivation flow
- [ ] Test RLS policies
- [ ] Update documentation

---

## 🎯 Business Logic Considerations

### Before Deactivating User:

Should check:
1. ✅ User is not currently logged in
2. ✅ User has no pending approvals
3. ✅ User has no active assignments
4. ⚠️ User has no ongoing workflows

### After Deactivation:

Should handle:
1. ✅ Reassign pending tasks to another user
2. ✅ Notify relevant stakeholders
3. ✅ Update audit logs
4. ✅ Close active sessions

---

## 🔒 Security Considerations

### RLS Policies:
- Deactivated users cannot SELECT their own profile
- Deactivated users cannot UPDATE anything
- Only admins can deactivate/reactivate users
- Audit trail must be immutable

### Session Management:
- Deactivated users' sessions should be terminated
- Prevent login attempts from deactivated users
- Show appropriate error message

---

## 📊 Summary

| Feature | Status | Priority |
|---------|--------|----------|
| View users | ✅ Implemented | - |
| Edit user assignment | ✅ Implemented | - |
| Reset password | ✅ Implemented | - |
| Create user | ✅ Implemented | - |
| **Deactivate user** | ❌ **Not implemented** | 🔴 **HIGH** |
| **Reactivate user** | ❌ **Not implemented** | 🔴 **HIGH** |
| Delete user (hard) | ❌ Not implemented | 🟡 Medium |
| View user status | ❌ Not implemented | 🔴 HIGH |
| Filter by status | ❌ Not implemented | 🟡 Medium |

---

## 🎯 Recommendation

**Implement Option 1: Soft Delete (Deactivation)**

Reasons:
- ✅ Data preservation
- ✅ Audit compliance
- ✅ Reversible
- ✅ Follows best practices
- ✅ Similar to existing department/position deactivation

**Priority:** HIGH - This is a fundamental admin feature that's missing.

---

**Status:** Feature gap identified  
**Action Required:** Implement user deactivation/reactivation system  
**Estimated Effort:** 4-6 hours (migration, functions, UI, testing)

