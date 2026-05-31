# RBAC (Role-Based Access Control) Audit Report

**Project:** Final_Production (Laravel + React/Inertia CRM)  
**Audit Date:** May 30, 2026  
**Auditor:** Kiro AI

---

## Executive Summary

This project implements a comprehensive RBAC system using **Spatie Laravel Permission** package with custom extensions. The architecture supports:

- ✅ Multiple roles per user
- ✅ Granular permission-based access control
- ✅ Multi-tenant isolation (company-based data segregation)
- ✅ Feature flags for plan-based module access
- ✅ Frontend navigation filtering based on permissions
- ✅ Middleware-based route protection

---

## 1. Database Schema

### 1.1 Core Tables

The RBAC system uses the standard Spatie Permission tables with custom extensions:

#### **`users` Table**
```sql
- id (bigint, PK)
- name (string)
- email (string, unique)
- type (string, 20) - Values: 'superadmin', 'company', or custom staff types
- plan_id (bigint, FK → plans)
- created_by (int) - Parent company ID for staff users
- plan_is_active (int)
- storage_limit (float)
- is_enable_login (int)
- ... other fields
```

**Key Design Decision:** The `type` field determines the user category, while `created_by` establishes the company hierarchy for multi-tenant isolation.

#### **`roles` Table**
```sql
- id (bigint, PK)
- name (string) - e.g., 'superadmin', 'company', 'sales-manager'
- guard_name (string) - 'web'
- label (string, nullable) - Human-readable name
- description (text, nullable)
- created_by (bigint, FK → users) - Company that owns this role
- timestamps
```

#### **`permissions` Table**
```sql
- id (bigint, PK)
- module (string, nullable) - Groups permissions by feature area
- name (string) - e.g., 'manage-leads', 'view-leads', 'create-leads'
- guard_name (string) - 'web'
- label (string, nullable)
- description (text, nullable)
- timestamps
- UNIQUE(name, guard_name)
```

#### **Junction Tables (Many-to-Many)**

| Table | Purpose |
|-------|---------|
| `model_has_roles` | Links users to roles |
| `model_has_permissions` | Links users directly to permissions |
| `role_has_permissions` | Links roles to permissions |

### 1.2 Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│    users    │       │   model_has_roles    │       │      roles      │
├─────────────┤       ├──────────────────────┤       ├─────────────────┤
│ id          │◄──────│ model_id             │───────►│ id              │
│ type        │       │ model_type           │       │ name            │
│ created_by  │       │ role_id              │       │ created_by      │
└─────────────┘       └──────────────────────┘       └────────┬────────┘
                                                              │
                      ┌──────────────────────┐                │
                      │ role_has_permissions │                │
                      ├──────────────────────┤                │
                      │ role_id              │◄───────────────┘
                      │ permission_id        │───────►┌─────────────────┐
                      └──────────────────────┘       │   permissions   │
                                                     ├─────────────────┤
                      ┌──────────────────────┐       │ id              │
                      │model_has_permissions │       │ module          │
                      ├──────────────────────┤       │ name            │
                      │ model_id             │       └─────────────────┘
                      │ permission_id        │───────────────►
                      └──────────────────────┘
```

---

## 2. User Hierarchy & Multi-Tenancy

### 2.1 User Types

| Type | Description | Scope |
|------|-------------|-------|
| `superadmin` | Platform administrator | Full system access |
| `company` | Company owner/tenant | Own company data |
| Staff (custom) | Company employees | Assigned by company owner |

### 2.2 Tenant Isolation Logic

```php
// From User.php
public function creatorId()
{
    if ($this->type == 'superadmin' || $this->type == 'company') {
        return $this->id;
    }
    return $this->created_by; // Staff returns their company's ID
}
```

**Data Isolation Pattern:**
- Super admins see all data
- Company owners see only their company's data
- Staff users see data based on their `created_by` (parent company)

---

## 3. Permission Architecture

### 3.1 Permission Naming Convention

Permissions follow a consistent pattern: `{action}-{module}`

| Action Prefix | Description |
|---------------|-------------|
| `manage-` | Full CRUD access to module |
| `manage-any-` | Access all records (cross-company for admins) |
| `manage-own-` | Access only self-created records |
| `view-` | Read-only access |
| `create-` | Create new records |
| `edit-` | Update existing records |
| `delete-` | Remove records |
| `toggle-status-` | Enable/disable records |
| `export-` | Export data |
| `import-` | Import data |

### 3.2 Module Categories

Based on `config/role-permissions.php`:

**Super Admin Modules:**
```php
'superadmin' => [
    'dashboard', 'users', 'roles', 'permissions', 'companies',
    'plans', 'plan_requests', 'plan_orders', 'domain_requests',
    'currencies', 'referral', 'coupons', 'appointments',
    'businesses', 'settings', 'conversations'
]
```

**Company Modules:**
```php
'company' => [
    'dashboard', 'users', 'roles', 'appointments', 'media',
    'currencies', 'webhooks', 'taxes', 'brands', 'categories',
    'products', 'contacts', 'accounts', 'leads', 'opportunities',
    'campaigns', 'cases', 'quotes', 'sales_orders', 'invoices',
    'delivery_orders', 'return_orders', 'purchase_orders',
    'receipt_orders', 'projects', 'project_tasks', 'meetings',
    'calls', 'documents', 'reports', 'conversations'
    // ... and more
]
```

### 3.3 Sample Permissions (from PermissionSeeder)

```php
// User Management
['name' => 'manage-users', 'module' => 'users', 'label' => 'Manage Users']
['name' => 'manage-any-users', 'module' => 'users', 'label' => 'Manage All Users']
['name' => 'manage-own-users', 'module' => 'users', 'label' => 'Manage Own Users']
['name' => 'view-users', 'module' => 'users', 'label' => 'View Users']
['name' => 'create-users', 'module' => 'users', 'label' => 'Create Users']
['name' => 'edit-users', 'module' => 'users', 'label' => 'Edit Users']
['name' => 'delete-users', 'module' => 'users', 'label' => 'Delete Users']

// Lead Management
['name' => 'manage-leads', 'module' => 'leads', 'label' => 'Manage Leads']
['name' => 'convert-leads', 'module' => 'leads', 'label' => 'Convert Leads']
['name' => 'export-leads', 'module' => 'leads', 'label' => 'Export Leads']
['name' => 'import-leads', 'module' => 'leads', 'label' => 'Import Leads']
```

---

## 4. Authentication & Authorization Implementation

### 4.1 Backend Middleware

#### **CheckPermission Middleware**
**Location:** `app/Http/Middleware/CheckPermission.php`

```php
public function handle(Request $request, Closure $next, string $permission): Response
{
    if (!auth()->check()) {
        return redirect()->route('login');
    }

    $user = auth()->user();
    
    // Super admin bypass - has all permissions
    if ($user->isSuperAdmin()) {
        return $next($request);
    }

    // Check specific permission
    if (!$user->hasPermissionTo($permission)) {
        if ($request->expectsJson()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return redirect()->route('dashboard.redirect');
    }

    return $next($request);
}
```

#### **SuperAdminMiddleware**
**Location:** `app/Http/Middleware/SuperAdminMiddleware.php`

```php
public function handle(Request $request, Closure $next)
{
    if (!auth()->user() || !auth()->user()->isSuperAdmin()) {
        return redirect()->back()->with('error', 'Unauthorized access');
    }
    return $next($request);
}
```

### 4.2 Route Protection Examples

```php
// From routes/web.php

// Permission-based protection
Route::middleware('permission:manage-permissions')->group(function () {
    Route::get('permissions', [PermissionController::class, 'index']);
    Route::post('permissions', [PermissionController::class, 'store'])
        ->middleware('permission:create-permissions');
});

// Module visibility + permission
Route::middleware(['permission:manage-notification-templates', 'checkModuleVisibility:notification_templates'])
    ->group(function () {
        Route::get('notification-templates', [NotificationTemplateController::class, 'index']);
    });

// Media routes with granular permissions
Route::get('api/media', [MediaController::class, 'index'])
    ->middleware('permission:manage-media');
Route::post('api/media/batch', [MediaController::class, 'batchStore'])
    ->middleware('permission:create-media');
Route::delete('api/media/{id}', [MediaController::class, 'destroy'])
    ->middleware('permission:delete-media');
```

### 4.3 Model-Level Permission Checking

#### **AutoApplyPermissionCheck Trait**
**Location:** `app/Traits/AutoApplyPermissionCheck.php`

This trait provides automatic query scoping based on user permissions:

```php
public function applyPermissionScope($query, $module)
{
    if (!auth()->check()) {
        return $query;
    }

    $user = auth()->user();
    
    // Superadmin sees everything
    if ($user->hasRole(['superadmin'])) {
        return $query;
    }
    
    // Company users see only their records
    if ($user->hasRole(['company'])) {
        if (Schema::hasColumn($query->getModel()->getTable(), 'created_by')) {
            return $query->where('created_by', $user->id);
        }
    }
    
    // Staff users see their company's records
    if ($user->type !== 'superadmin' && $user->created_by) {
        if (Schema::hasColumn($query->getModel()->getTable(), 'created_by')) {
            return $query->where('created_by', $user->created_by);
        }
    }
    
    // Check for manage-any permission
    if ($user->hasPermissionTo("manage-any-{$module}")) {
        return $query;
    }
    
    // Check for manage-own permission
    if ($user->hasPermissionTo("manage-own-{$module}")) {
        return $query->where('created_by', $user->id);
    }
    
    return $query;
}
```

### 4.4 Laravel Policies

**Location:** `app/Policies/`

Example from `WeddingSupplierPolicy.php`:

```php
public function viewAny(User $user): bool
{
    if ($user->isSuperAdmin()) {
        return true;
    }

    // Check feature flag for company
    $company = $user->type === 'company' ? $user : $user->creator;
    if ($company && $company->type === 'company') {
        return $company->hasFeature('wedding_suppliers_module');
    }

    return false;
}

public function create(User $user): bool
{
    return $user->isSuperAdmin();
}
```

---

## 5. Frontend Authorization

### 5.1 Shared Auth Data (Inertia)

**Location:** `app/Http/Middleware/HandleInertiaRequests.php`

```php
'auth' => [
    'user' => $request->user(),
    'roles' => fn() => $request->user()?->roles->pluck('name'),
    'permissions' => fn() => $request->user()?->getAllPermissions()->pluck('name'),
    'plan_features' => function () use ($request) {
        // Returns plan-based feature flags
    },
    'company_features' => function () use ($request) {
        // Returns company-specific feature flags
    },
    'disabled_modules' => function () use ($request) {
        // Returns modules disabled for this user
    },
]
```

### 5.2 Frontend Permission Utilities

#### **authorization.ts**
**Location:** `resources/js/utils/authorization.ts`

```typescript
export const hasRole = (role: string, userRoles: string[] = []) =>
    userRoles.includes(role);

export const hasPermission = (userPermissions: string[], permission: string) =>
    userPermissions.includes(permission);
```

#### **permissions.ts**
**Location:** `resources/js/utils/permissions.ts`

```typescript
export const hasPermission = (permission: string): boolean => {
    const { auth } = usePage().props as any;
    
    if (!auth || !auth.user || !auth.permissions) {
        return false;
    }
    
    return auth.permissions.includes(permission);
};

export const hasAnyPermission = (permissions: string[]): boolean => {
    const { auth } = usePage().props as any;
    
    if (!auth || !auth.user || !auth.permissions) {
        return false;
    }
    
    return permissions.some(permission => auth.permissions.includes(permission));
};
```

### 5.3 Navigation/Sidebar Filtering

**Location:** `resources/js/components/app-sidebar.tsx`

The sidebar dynamically builds navigation based on user permissions:

```typescript
const getCompanyNavItems = (): NavItem[] => {
    const items: NavItem[] = [];

    // Dashboard - requires manage-dashboard permission
    if (hasPermission(permissions, 'manage-dashboard')) {
        items.push({
            title: t('Dashboard'),
            href: route('dashboard'),
            icon: LayoutGrid,
        });
    }

    // Staff section - requires user/role management permissions
    const staffChildren = [];
    if (hasPermission(permissions, 'manage-users')) {
        staffChildren.push({ title: t('Users'), href: route('users.index') });
    }
    if (hasPermission(permissions, 'manage-roles')) {
        staffChildren.push({ title: t('Roles'), href: route('roles.index') });
    }
    if (staffChildren.length > 0) {
        items.push({ title: t('Staff'), icon: Users, children: staffChildren });
    }

    // Lead Management - checks module disabled + permissions
    if (!disabledModules.includes('leads')) {
        const leadChildren = [];
        if (hasPermission(permissions, 'manage-lead-statuses')) {
            leadChildren.push({ title: t('Lead Statuses'), href: route('lead-statuses.index') });
        }
        if (hasPermission(permissions, 'manage-leads')) {
            leadChildren.push({ title: t('Leads'), href: route('leads.index') });
        }
        // ... more items
    }

    // Feature-flagged modules
    if (companyFeatures?.includes('wedding_suppliers_module')) {
        items.push({
            title: t('Wedding Suppliers'),
            icon: Users,
            children: [{ title: t('Suppliers'), href: route('wedding-suppliers.index') }]
        });
    }

    return items;
};
```

### 5.4 TypeScript Types

**Location:** `resources/js/types/index.ts`

```typescript
export interface NavItem {
    title: string;
    href?: string;
    icon?: React.ElementType;
    permission?: string;  // Optional permission requirement
    children?: NavItem[];
    badge?: { label: string; variant?: string };
}

export interface SharedData {
    auth: {
        user: {
            id: number;
            name: string;
            type?: string;
            // ...
        } | null;
    };
}
```

---

## 6. Role Definitions

### 6.1 System Roles (from RoleSeeder)

#### **Super Admin**
- Has ALL permissions
- Can manage all companies and platform settings
- Cannot be deleted (system role)

#### **Company**
- Default role for company owners
- Has comprehensive CRM permissions
- Can create custom roles for staff

### 6.2 Staff Role Templates (from StaffRoleSeeder)

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `sales-manager` | Sales operations lead | Leads, Contacts, Accounts, Opportunities, Quotes, Orders, Invoices |
| `product-manager` | Product & inventory | Products, Categories, Brands, Taxes |
| `accountant` | Financial operations | Invoices, Taxes, Purchase Orders, Receipt Orders |
| `inventory-manager` | Stock management | Products, Delivery Orders, Return Orders, Purchase Orders |
| `sales-rep` | Sales representative | Leads, Contacts, Accounts, Opportunities, Quotes (limited) |
| `manager` | Comprehensive access | Most modules with full CRUD |
| `project-manager` | Project operations | Projects, Tasks, Meetings, Calls, Documents |
| `support-agent` | Customer support | Cases, view-only access to most modules |

---

## 7. Feature Flags & Plan-Based Access

### 7.1 Plan Features

Users can have features enabled/disabled based on their subscription plan:

```php
// From User.php
public function hasFeature($key)
{
    // Check explicit feature flags first
    $flag = $this->featureFlags()
        ->where('feature_key', $key)
        ->first();

    if ($flag) {
        return $flag->is_enabled;
    }

    // Fallback to Plan features
    if ($this->plan && is_array($this->plan->module) && in_array($key, $this->plan->module)) {
        return true;
    }

    return false;
}
```

### 7.2 Module Visibility

The `CheckModuleVisibility` middleware and `disabled_modules` auth data control which modules are accessible:

```typescript
// Frontend check
if (!disabledModules.includes('leads') && hasPermission(permissions, 'manage-leads')) {
    // Show leads menu item
}
```

---

## 8. Security Assessment

### 8.1 Strengths

| Aspect | Implementation | Rating |
|--------|----------------|--------|
| **Multi-layer protection** | Middleware + Model scopes + Policies | ✅ Strong |
| **Granular permissions** | Action-level permissions (view, create, edit, delete) | ✅ Strong |
| **Multi-tenancy** | `created_by` based isolation | ✅ Strong |
| **Super admin bypass** | Explicit check in all layers | ✅ Consistent |
| **Frontend sync** | Permissions shared via Inertia | ✅ Good |
| **Caching** | Spatie permission caching (24h) | ✅ Good |

### 8.2 Potential Improvements

| Area | Current State | Recommendation |
|------|---------------|----------------|
| **Policy coverage** | Only 2 policies exist | Create policies for all major models |
| **Permission wildcards** | Disabled | Consider enabling for admin roles |
| **Audit logging** | Not visible in audit | Add permission change logging |
| **API protection** | Uses same middleware | Consider API-specific guards |

---

## 9. Key Code Snippets

### 9.1 Checking Permissions in Controllers

```php
// Using middleware
Route::get('leads', [LeadController::class, 'index'])
    ->middleware('permission:manage-leads');

// Using Gate/Policy
public function index()
{
    $this->authorize('viewAny', Lead::class);
    // ...
}

// Manual check
if (!auth()->user()->hasPermissionTo('manage-leads')) {
    abort(403);
}
```

### 9.2 Assigning Roles & Permissions

```php
// Assign role to user
$user->assignRole('sales-manager');

// Assign multiple roles
$user->assignRole(['sales-manager', 'project-manager']);

// Sync permissions to role
$role->syncPermissions($permissionArray);

// Give direct permission to user
$user->givePermissionTo('manage-leads');
```

### 9.3 Frontend Permission Check

```tsx
// In React component
const { auth } = usePage().props;
const permissions = auth?.permissions || [];

{hasPermission(permissions, 'manage-leads') && (
    <Link href={route('leads.index')}>Leads</Link>
)}
```

---

## 10. Configuration Files

### 10.1 Spatie Permission Config

**Location:** `config/permission.php`

```php
return [
    'models' => [
        'permission' => App\Models\Permission::class,  // Custom model
        'role' => App\Models\Role::class,              // Custom model
    ],
    'table_names' => [
        'roles' => 'roles',
        'permissions' => 'permissions',
        'model_has_permissions' => 'model_has_permissions',
        'model_has_roles' => 'model_has_roles',
        'role_has_permissions' => 'role_has_permissions',
    ],
    'teams' => false,  // Team feature disabled
    'cache' => [
        'expiration_time' => \DateInterval::createFromDateString('24 hours'),
        'key' => 'spatie.permission.cache',
    ],
];
```

---

## 11. Summary

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        RBAC Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │    │  Middleware  │    │    Model     │       │
│  │  (React/TS)  │    │   (Laravel)  │    │   (Eloquent) │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ hasPermission│    │CheckPermission│   │PermissionScope│      │
│  │ (utility)    │    │ Middleware   │    │   (Trait)    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             ▼                                    │
│                   ┌──────────────────┐                          │
│                   │  Spatie Laravel  │                          │
│                   │    Permission    │                          │
│                   └────────┬─────────┘                          │
│                            ▼                                     │
│                   ┌──────────────────┐                          │
│                   │    Database      │                          │
│                   │ (roles, perms)   │                          │
│                   └──────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Findings

| Question | Answer |
|----------|--------|
| **Supports multiple roles per user?** | ✅ Yes - via Spatie's HasRoles trait |
| **Permission-based or role-based?** | ✅ Both - Hybrid approach |
| **How modular/configurable?** | ✅ Highly modular - permissions grouped by module |
| **Multi-tenant support?** | ✅ Yes - via `created_by` field |
| **Frontend integration?** | ✅ Yes - via Inertia shared data |
| **Caching?** | ✅ Yes - 24-hour permission cache |

---

## Appendix A: Complete Permission List

See `database/seeders/PermissionSeeder.php` for the full list of 200+ permissions organized by module.

## Appendix B: Migration Files

| File | Purpose |
|------|---------|
| `0001_01_01_000000_create_users_table.php` | Users table with type and created_by |
| `2025_05_25_000000_create_permission_tables.php` | Spatie permission tables |

---

*End of RBAC Audit Report*
