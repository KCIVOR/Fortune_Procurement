# Module Visibility "Add Mode" Feature

## Overview

This feature extends the existing Module Visibility system to allow positions to **add modules from other roles**, not just hide modules from their own role.

## Use Case

**Problem**: Carlos Mendoza has the "Buyer" position with "approver" role. As an approver, he only sees approval-related modules (PR1/PR2/PO approvals). However, as a Buyer, he needs access to procurement modules like:
- `/po` - Purchase Orders
- `/rfq` - Canvassing / RFQ
- `/pr2` - Purchase Requests

**Solution**: Admin can now add procurement modules to the Buyer position, even though Buyer's role is "approver".

## How It Works

### Database Schema

Added `source_role_id` column to `role_position_module_visibility` table:

```sql
ALTER TABLE public.role_position_module_visibility
ADD COLUMN source_role_id uuid REFERENCES public.roles (id) ON DELETE CASCADE;
```

- When `source_role_id` is NULL: Rule applies to the position's own role modules (hide/show)
- When `source_role_id` is set: Module is "borrowed" from another role (add mode)

### Navigation Resolution

The `resolveVisibleModules()` function now:
1. Gets visible modules from the user's own role (with hide/show rules applied)
2. Gets "added" modules from other roles for the user's position
3. Combines both sets for the final navigation

### Admin UI

The Module Visibility page (`/admin/module-visibility`) now has two sections when a position is selected:

1. **Role Modules**: Toggle visibility of modules that belong to the selected role
2. **Added Modules from Other Roles**: Add/remove modules borrowed from other roles

## Configuration Steps

### To Add Procurement Modules to Buyer Position:

1. Go to **Admin → Module Visibility**
2. Select **Role**: `approver`
3. Select **Position scope**: `Buyer`
4. In the "Added Modules from Other Roles" section, click **Add Module**
5. Select **Source Role**: `procurement`
6. Check the modules to add:
   - ✅ Purchase Orders (`/po`)
   - ✅ Canvassing / RFQ (`/rfq`)
   - ✅ Purchase Requests (`/pr2`)
7. Click **Add Modules**
8. Click **Save changes**

### Result

Carlos Mendoza (Buyer) will now see:
- Approver modules: PR1 Requests, PR2 Requests, Purchase Orders (approvals), Approval History
- Added procurement modules: Purchase Orders, Canvassing / RFQ, Purchase Requests

## Technical Details

### Files Modified

1. **Database Migration**: `supabase/migrations/20260521130000_module_visibility_add_mode.sql`
   - Added `source_role_id` column
   - Added indexes for efficient lookups

2. **Navigation Config**: `config/navigation.ts`
   - Exported `ALL_NAV` for module lookup

3. **Module Visibility Library**: `lib/module-visibility.ts`
   - Added `AddedModuleRule` interface
   - Updated `fetchModuleVisibilityRules()` to include added modules
   - Added `fetchAddedModulesForPosition()`
   - Added `isAddedModule()`, `getAddedModules()`
   - Updated `resolveVisibleModules()` to combine role + added modules
   - Added `addModuleFromOtherRole()`, `removeAddedModule()`, `saveAddedModulesForPosition()`

4. **Admin UI**: `app/admin/module-visibility/page.tsx`
   - Added "Added Modules from Other Roles" section
   - Added "Add Module" dialog to select modules from other roles

### API Functions

```typescript
// Add a module from another role to a position
await addModuleFromOtherRole(roleId, positionId, moduleKey, sourceRoleId);

// Remove an added module
await removeAddedModule(roleId, positionId, moduleKey, sourceRoleId);

// Bulk save added modules for a position
await saveAddedModulesForPosition(roleId, positionId, [
  { module_key: 'purchase_orders', source_role_id: procurementRoleId },
  { module_key: 'canvassing_rfq', source_role_id: procurementRoleId },
]);
```

## Route access alignment (Phase 5 / D6)

Module keys map to URL prefixes in `config/module-route-map.ts`. **Route enforcement** is in `config/route-access.ts` + `middleware.ts` (Phases 3–4).

| Module key | Route prefix |
|------------|----------------|
| `goods_receipt` | `/grn` |
| `canvassing_rfq` | `/rfq` |
| `purchase_orders` | `/po` |
| `purchase_requests` | `/pr2` |
| `warehouse_validation` | `/warehouse` |
| `my_requests` | `/pr1` |

Hiding a module in admin UI does **not** block direct URLs — middleware does.

### Fail-closed behavior (Phase 5)

If visibility rules cannot be loaded, the sidebar and dashboards only show the **`dashboard`** module until the fetch succeeds. This replaces the previous fail-open behavior (empty rules = show all).

---

## Important Notes

1. **This only affects navigation visibility** - it does not change route permissions or RLS policies
2. **Position-specific only** - Add mode only works when a specific position is selected, not for role defaults
3. **Cache clearing** - The visibility cache is automatically cleared after changes
4. **No duplicate modules** - A module can only appear once in navigation (either from role or added)

## Troubleshooting

### User doesn't see added modules
1. Verify the user has the correct position assigned
2. Check that the module visibility rules were saved
3. Have the user log out and log back in (to clear client-side cache)

### Module appears twice
This shouldn't happen - the system filters out duplicates. If it does:
1. Check for duplicate entries in `role_position_module_visibility` table
2. Clear the visibility cache by calling `clearModuleVisibilityCache()`
