# Fortune Procurement System — Full System Audit

**Audit Date:** June 5, 2026  
**Audit Scope:** Application codebase, Supabase migration schema, configuration files  
**Audit Method:** Static code analysis and migration review  
**Live Database Verification:** Not performed — Supabase MCP authentication was not completed during this audit  

**Important:** This audit documents only what is verifiably present in the repository. Nothing is assumed from the legacy HRIS user manual (`docs/HRIS Documentation (User Manual) as of Aug 12.docx`), which describes a different product.

---

## 1. Executive Summary

| Attribute | Verified Finding |
|-----------|------------------|
| **Application Name** | Fortune Procurement System (branded "Procurement System" / ProcureIQ in UI) |
| **Purpose** | End-to-end procurement automation: PR1 → warehouse validation → approval → RFQ → PR2 → PO → delivery → GRN |
| **Framework** | Next.js 13.5.1 (App Router), React 18, TypeScript |
| **Database** | Supabase PostgreSQL with Row Level Security (RLS) |
| **Auth** | Supabase Auth (email/password), cookie-based sessions via `@supabase/ssr` |
| **NOT an HRIS** | No payroll, attendance, leave, recruitment, performance management, or employee lifecycle modules exist in code |

**Evidence:** `app/layout.tsx` (metadata title), `package.json`, `supabase/migrations/`

---

## 2. Technology Stack

| Layer | Technology | Evidence |
|-------|------------|----------|
| Frontend | Next.js 13.5.1, React 18, Tailwind CSS 3, Radix UI | `package.json` |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) | `lib/supabase.ts`, `supabase/` |
| Forms | react-hook-form, zod | `package.json` |
| Email | Brevo, Resend, `@react-email/render` | `package.json`, `app/api/` |
| Charts | recharts | `package.json` |
| Notifications | In-app bell + optional Viber | `lib/notifications.ts`, `lib/viber-utils.ts` |

---

## 3. User Roles & Positions (Verified)

### 3.1 Application Roles (7)

Defined in `types/auth.ts` and seeded in migrations:

| Role | Purpose | Seeded In |
|------|---------|-----------|
| `employee` | Creates PR1s, tracks deliveries, reviews substitute items | `20260423215953_foundation_schema.sql` |
| `warehouse` | Warehouse validation, GRN, delivery tracking | same |
| `procurement` | PR2, RFQ, PO, accreditation, product review, approvals | same |
| `approver` | PR1/PR2/PO approval queues (position-specific) | same |
| `supplier` | External supplier portal | same |
| `admin` | User/org config, audit, workflows, module visibility | `20260429124542_add_admin_role_and_demo_user.sql` |
| `tsqa` | RSE scientific review | `20260507000100_add_tsqa_role.sql` |

### 3.2 Positions (13)

Defined in `types/auth.ts`, mapped to roles via `positions.role_id`:

Staff, Warehouse Staff, Warehouse Manager, Procurement Staff, Authorized Personnel, Buyer, Procurement Manager, Supervisor, Department Head, Director, Finance Director, Supplier Representative, System Administrator, TSQA Staff

### 3.3 Departments (8, seeded)

EXEC, FIN, OPS, IT, HR, PROC, WH, GS — from `20260423215953_foundation_schema.sql`

**Note:** "Human Resources" (`HR`) is organizational reference data only. No HR module exists.

---

## 4. Access Control (Verified)

### 4.1 Middleware Route RBAC

Source: `config/route-access.ts`, enforced in `middleware.ts`

| Route Prefix | Allowed Roles | Notes |
|--------------|---------------|-------|
| `/login`, `/forgot-password`, `/reset-password`, `/invite/complete` | Public | No session required |
| `/supplier` | `supplier` only | Admin bypass **disabled** |
| `/admin` | `admin` | |
| `/warehouse` | `warehouse` | |
| `/grn` | `warehouse`, `procurement` | Director approver also allowed (see below) |
| `/rfq`, `/pr2`, `/po` | `procurement` | Director approver also allowed |
| `/pr1` (list) | `employee` | |
| `/pr1/new` | `employee` | |
| `/pr1/*` (detail) | `employee`, `warehouse`, `procurement`, `approver`, `admin` | |
| `/approvals` | `approver`, `procurement` | |
| `/accreditation` | `procurement`, `tsqa`, `admin` | |
| `/tsqa` | `tsqa`, `admin` | |
| `/substitutes` | `employee` | |
| `/delivery` | `employee`, `warehouse`, `procurement` | Director approver also allowed |
| `/bugtrack`, `/messages`, `/profile`, `/dashboard` | Any authenticated | |
| Unlisted paths | Any authenticated | |

**Director exception:** `approver` + position `Director` may access `/grn`, `/rfq`, `/pr2`, `/po`, `/delivery` (`DIRECTOR_LOGISTICS_PREFIXES` in `route-access.ts`).

### 4.2 Workflow-Step Authority

Approval actions require exact **role + position** match per `approval_steps` table. Verified in `lib/approvals.ts`, `lib/pr2-approvals.ts`, `lib/po-approvals.ts`.

### 4.3 Module Visibility (UI only — NOT security)

`role_position_module_visibility` table controls sidebar and dashboard KPI visibility. Does not grant route access. Source: `lib/module-visibility.ts`, migration `20260510120000_role_position_module_visibility.sql`.

Fail-closed: if visibility rules fail to load, only Dashboard is shown.

### 4.4 Commercial Price Visibility

Source: `lib/price-visibility.ts`

| Can View Prices | Roles/Positions |
|-----------------|-----------------|
| Yes | `admin`, `procurement`, `approver` + Director or Finance Director |
| No (shows "Price hidden") | All other roles |

### 4.5 Database RLS

All 41 `public` tables have RLS enabled. Policies defined across 113 migration files.

---

## 5. Application Routes (Verified)

No `pages/` directory. All routes under `app/`.

### Public / Auth
- `/` — redirects to `/login`, `/dashboard`, or `/tsqa`
- `/login`, `/forgot-password`, `/reset-password`, `/invite/complete`

### Core (authenticated)
- `/dashboard`, `/profile`, `/messages`, `/messages/new`, `/bugtrack`, `/bugtrack/[id]`

### Employee
- `/pr1`, `/pr1/new`, `/pr1/[id]`, `/pr1/[id]/edit`, `/pr1/[id]/print`
- `/substitutes`, `/substitutes/[pr1Id]`
- `/delivery`, `/delivery/[id]`

### Warehouse
- `/warehouse`, `/warehouse/[id]`, `/warehouse/history`
- `/grn`, `/grn/[id]`, `/grn/[id]/print`

### Procurement
- `/pr2`, `/pr2/[id]`, `/pr2/[id]/print`
- `/rfq`, `/rfq/[id]`
- `/po`, `/po/new`, `/po/[id]`, `/po/[id]/print`
- `/accreditation`, `/accreditation/[id]`, `/accreditation/products`, `/accreditation/products/[id]`

### Approvals
- `/approvals`, `/approvals/[id]`, `/approvals/pr1`, `/approvals/pr2`, `/approvals/pr2/[id]`, `/approvals/po`, `/approvals/po/[id]`, `/approvals/history`

### Supplier Portal
- `/supplier/accreditation`, `/supplier/products`, `/supplier/products/new`, `/supplier/products/[id]`
- `/supplier/quotations`, `/supplier/quotations/[rfqSupplierId]`
- `/supplier/po`, `/supplier/po/[id]`, `/supplier/delivery`, `/supplier/delivery/[id]`

### TSQA
- `/tsqa`, `/tsqa/rse`, `/tsqa/rse/[id]`

### Admin
- `/admin`, `/admin/users`, `/admin/users/[id]`, `/admin/users/[id]/edit`
- `/admin/roles`, `/admin/positions`, `/admin/departments`
- `/admin/audit`, `/admin/module-visibility`, `/admin/workflows`

### Dev-only (blocked in production)
- `/test-dashboard`, `/test-filter`

---

## 6. Navigation Structure (Verified)

Source: `config/navigation.ts`, rendered in `components/layout/Sidebar.tsx`

| Role | Sidebar Items (in order) |
|------|--------------------------|
| **admin** | Dashboard → User Management → Roles → Positions → Departments → Workflows → Module Visibility → Audit Logs |
| **employee** | Dashboard → My Requests → Delivery Status → Substitute Review |
| **warehouse** | Dashboard → Warehouse Queue → Goods Receipt → Delivery Tracking → Warehouse History |
| **procurement** | Dashboard → PR2 Requests → Canvassing/RFQ → Purchase Orders → Delivery Tracking → Goods Receipt → Supplier Accreditation → Product Review → Approval Queue → Approval History |
| **approver** | Dashboard → PR1 Requests → PR2 Requests → Purchase Orders → Approval History |
| **supplier** | Dashboard → Quotations → Purchase Orders → Deliveries → Product Catalog → Accreditation |
| **tsqa** | Dashboard (`/tsqa`) → RSE Queue |

**Top header** (all roles with profile): Department, Position, Notification Bell, Messages, Bug Track, Profile link — `components/layout/TopHeader.tsx`

---

## 7. Dashboards (Verified)

| Role | Component | KPIs / Content |
|------|-----------|----------------|
| employee | `EmployeeDashboard.tsx` | Total/Pending/Approved/Rejected PR1s, pending substitute count, recent PR1 table, New PR1 CTA |
| warehouse | `WarehouseDashboard.tsx` | Pending validation, validated today, open/closed GRNs, pending PR1 queue, open GRN queue |
| procurement | `ProcurementDashboard.tsx` | Awaiting RFQ, open RFQs, high priority, PO count, accreditation queue, pending TSQA |
| approver | `ApproverDashboard.tsx` | Unified PR1+PR2+PO queue (actionable steps only), weekly approve/reject stats |
| supplier | `SupplierDashboard.tsx` | Open RFQs, pending responses, accreditation status, product catalog compliance |
| admin | `AdminDashboard.tsx` | User/role/position/department/audit counts, recent audit log entries |
| tsqa | `app/tsqa/page.tsx` | RSE stats (created/assigned/under review/passed/failed), RSE work queue |

Module visibility may hide dashboard KPI bands when modules are disabled.

---

## 8. Procurement Workflow (Verified)

### 8.1 Document Types

Seeded in `20260423221510_seed_workflow_definitions.sql`:

| Code | Name |
|------|------|
| PR1 | Purchase Request (employee-initiated) |
| PR2 | Purchase Request v2 (procurement-managed, dual-phase) |
| RFQ | Request for Quotation |
| PO | Purchase Order |
| GRN | Goods Receipt Note |

### 8.2 Approval Workflows

| Workflow | Steps | Positions |
|----------|-------|-----------|
| PR1_APPROVAL | 2 | Supervisor → Department Head (final) |
| PR2_PHASE1 | 4 | Procurement Staff → Dept Head → Proc Manager → Director (final) |
| PR2_PHASE2 | 3 | Buyer → Proc Manager → Director (final) |
| PO_APPROVAL | 4 | Buyer → Proc Manager → Finance Director → Supplier Rep (final) |

### 8.3 PR1 Status Values

From `types/pr1.ts`: `draft`, `pending_warehouse`, `pending_approval`, `resolved_internal`, `revision_requested`, `for_canvassing`, `canvassing_complete`, `approved`, `rejected`, `cancelled`

### 8.4 End-to-End Flow

```
Employee creates PR1
  → Warehouse validates (sufficient/insufficient)
  → PR1 approval (Supervisor → Dept Head)
  → RFQ/Canvassing (procurement invites suppliers)
  → Employee reviews substitute items (if applicable)
  → PR2 generated (Phase 1 + Phase 2 approvals)
  → PO created and approved
  → Supplier acknowledges PO
  → Delivery tracking
  → GRN (goods receipt)
```

Parallel tracks:
- Supplier accreditation + product catalog + RSE/TSQA review (for raw materials/compliance)

---

## 9. Database Schema (Verified from Migrations)

**41 tables** in `public` schema. No Prisma. No PostgreSQL ENUM types (status values use TEXT + CHECK constraints).

### Identity & Access (5)
`departments`, `roles`, `positions`, `profiles`, `role_position_module_visibility`

### Workflow Infrastructure (7)
`controlled_form_templates`, `controlled_form_versions`, `approval_workflows`, `approval_steps`, `approval_instances`, `approval_actions`, `notifications`, `audit_logs`

### Procurement Documents (22)
`pr1_requests`, `pr1_items`, `warehouse_validations`, `warehouse_validation_items`, `rfq_batches`, `rfq_suppliers`, `rfq_item_quotes`, `supplier_item_selections`, `substitute_decisions`, `pr2_requests`, `pr2_items`, `po_requests`, `po_items`, `po_receipts`, `deliveries`, `delivery_status_history`, `grn_receipts`, `grn_items`

### Supplier Compliance (5)
`supplier_accreditations`, `supplier_products`, `supplier_documents`, `rse_records`, `tsqa_reviews`

### Platform (4)
`bug_reports`, `bugtrack_settings`, `conversations`, `messages`, `message_attachments`

### Storage Buckets (verified in migrations)
`delivery-receipts`, `message-attachments`, `supplier-accreditation`

### External (not in app migrations)
`auth.users`, `auth.identities`, `storage.objects`

---

## 10. API Routes (Verified)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/admin/users/create` | POST | Admin JWT | Create user with temp password |
| `/api/admin/users/invite` | POST | Admin JWT | Supabase invite email |
| `/api/admin/users/[id]/reset-password` | POST | Admin JWT | Reset password |
| `/api/admin/users/[id]/assignment` | PATCH | Admin JWT | Update role/dept/position |
| `/api/rfq/send-email` | POST | Authenticated | Send RFQ email |
| `/api/bugtrack/send-email` | POST | Authenticated | Bug report email |
| `/api/bugtrack/send-resolved-email` | POST | Authenticated | Bug resolved notification |

**Supabase Edge Functions:** `create-user`, `reset-user-password`, `reset-demo-passwords`

Most business logic runs client-side via Supabase client + RLS, not Next.js API routes.

---

## 11. Authentication (Verified)

- Login: email + password via `supabase.auth.signInWithPassword`
- No `admin`/`admin` default credentials
- Demo credentials exposed on login page accordion (development): `Fortune2024!` password for seeded accounts
- Post-login redirect: `tsqa` → `/tsqa`; all others → `/dashboard`
- Remember me: `localStorage.rememberMe`; otherwise `sessionStorage.tempSession`
- Invite flow: admin invites → `/invite/complete` → set password
- Profile page: user can update full name and password; role/department/position are read-only

---

## 12. Platform Features (Verified)

| Feature | Implementation |
|---------|----------------|
| Notifications | In-app bell, cursor pagination, mark read/all read (`lib/notifications.ts`) |
| Messaging | 1:1 conversations, attachments, read receipts (`lib/messages.ts`) |
| BugTrack | Internal bug reporting with email notifications (`lib/bugtrack.ts`) |
| Audit Logs | Immutable action trail, admin view (`lib/audit.ts`) |
| Print Views | PR1, PR2, PO, GRN printable pages |
| FilterBar | Search, tabs, filters, pagination on list pages (`components/shared/FilterBar.tsx`) |
| Viber | Optional notifications (`lib/viber-utils.ts`) |

---

## 13. Admin Capabilities (Verified)

| Module | Route | Capabilities |
|--------|-------|--------------|
| User Management | `/admin/users` | Create, invite, reset password, assign role/dept/position |
| Roles | `/admin/roles` | View roles with user counts |
| Positions | `/admin/positions` | View/manage positions |
| Departments | `/admin/departments` | View/manage departments |
| Workflows | `/admin/workflows` | Edit approval workflow steps |
| Module Visibility | `/admin/module-visibility` | Toggle sidebar modules per role/position; borrow modules from other roles |
| Audit Logs | `/admin/audit` | View system audit trail |

---

## 14. Features NOT Present (Verified Absent)

The following exist in the legacy HRIS manual but are **not implemented** in this codebase:

- Payroll, payslips, salary templates
- Time & attendance, clock in/out, office shifts, holidays
- Leave management
- Employee 201 file (immigration, emergency contacts, qualifications, etc.)
- Performance management, appraisals, goal tracking
- Recruitment / ATS / job portal CMS
- Training modules
- Events & meetings calendar (HR calendar)
- Finance module (accounts, deposits, expenses, transfers) — procurement has PO pricing only
- Assets management
- File manager (general document storage)
- CRM / client invoicing (client role does not exist; `supplier` is external vendor)
- Empty Database / Export Database admin actions
- IP-based attendance restriction
- Multi-language settings
- Mail server configuration UI (email uses env-configured providers)

---

## 15. Demo / Seed Data (Verified in Migrations)

| Data | Source |
|------|--------|
| 8 departments | `foundation_schema.sql` |
| 7 roles + 13 positions | foundation + admin + tsqa migrations |
| Form templates + approval workflows | `seed_workflow_definitions.sql` |
| Demo users (password `Fortune2024!`) | `seed_demo_users.sql`, `add_admin_role_and_demo_user.sql`, `seed_additional_demo_suppliers.sql` |
| bugtrack_settings singleton | `bugtrack_settings_schema.sql` |

**No seed data** for PR1/PR2/PO/RFQ transaction rows in migrations.

---

## 16. Audit Limitations

1. **Live database not queried** — Supabase MCP authentication was skipped; table row counts, production data, and runtime RLS behavior were not verified against a live instance.
2. **Runtime configuration** — `.env.local` values (Supabase URL, email keys, Viber tokens) were not inspected for secrets; only `.env.example` structure is referenced.
3. **UI screenshots** — This audit is code-based; visual layout may differ from rendered UI.
4. **Edge function behavior** — Supabase Edge Functions are listed but not execution-tested.

---

## 17. Key Evidence Files

| Area | Path |
|------|------|
| App identity | `app/layout.tsx` |
| Navigation | `config/navigation.ts` |
| Route RBAC | `config/route-access.ts`, `middleware.ts` |
| Roles/positions | `types/auth.ts` |
| DB foundation | `supabase/migrations/20260423215953_foundation_schema.sql` |
| Workflow seed | `supabase/migrations/20260423221510_seed_workflow_definitions.sql` |
| Dashboards | `components/dashboards/` |
| Price visibility | `lib/price-visibility.ts` |
| Module visibility | `lib/module-visibility.ts` |
