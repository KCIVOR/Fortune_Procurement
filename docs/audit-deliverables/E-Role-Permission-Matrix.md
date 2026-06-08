# Document E — Role & Permission Matrix
## Fortune Procurement System

**Source:** `types/auth.ts`, `config/route-access.ts`, `config/navigation.ts`, `lib/price-visibility.ts`, RLS migrations, workflow seeds

---

## 1. Role Summary

| Role | Display Context | Primary Responsibility |
|------|-----------------|------------------------|
| `employee` | Internal staff | Create PR1 requests, track deliveries, review substitute items |
| `warehouse` | Warehouse operations | Validate PR1 stock, receive goods (GRN), track deliveries |
| `procurement` | Procurement department | RFQ, PR2, PO, supplier accreditation, product review, partial approvals |
| `approver` | Supervisors / managers | PR1, PR2, PO approval actions (position-specific) |
| `supplier` | External vendor portal | Submit quotes, acknowledge POs, manage deliveries, catalog, accreditation |
| `admin` | System administrator | User/org management, workflows, module visibility, audit logs |
| `tsqa` | Technical/Scientific QA | RSE scientific evaluation and product testing |

**Note:** There is no `Super Admin` role name in code — system administration uses role `admin` with position `System Administrator`.

---

## 2. Positions by Role

| Role | Positions (from `types/auth.ts` + seeds) |
|------|---------------------------------------------|
| employee | Staff |
| warehouse | Warehouse Staff, Warehouse Manager |
| procurement | Procurement Staff, Authorized Personnel, Buyer, Procurement Manager |
| approver | Supervisor, Department Head, Director, Finance Director |
| supplier | Supplier Representative |
| admin | System Administrator |
| tsqa | TSQA Staff |

---

## 3. Route Access Matrix

| Route Prefix | employee | warehouse | procurement | approver | supplier | admin | tsqa | Notes |
|--------------|:--------:|:---------:|:-----------:|:--------:|:--------:|:-----:|:----:|-------|
| `/login`, `/forgot-password`, `/reset-password`, `/invite/complete` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Public |
| `/dashboard`, `/profile`, `/messages`, `/bugtrack` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Authenticated |
| `/pr1` (list) | ✓ | — | — | — | — | ✓ | — | |
| `/pr1/new` | ✓ | — | — | — | — | ✓ | — | |
| `/pr1/[id]` | ✓* | ✓ | ✓ | ✓ | — | ✓ | — | *employee: own only |
| `/substitutes` | ✓ | — | — | — | — | ✓ | — | |
| `/delivery` | ✓ | ✓ | ✓ | — | — | ✓ | — | |
| `/warehouse` | — | ✓ | — | — | — | ✓ | — | |
| `/grn` | — | ✓ | ✓ | — | — | ✓ | — | Director also |
| `/rfq`, `/pr2`, `/po` | — | — | ✓ | — | — | ✓ | — | Director also |
| `/approvals` | — | — | ✓ | ✓ | — | ✓ | — | |
| `/accreditation` | — | — | ✓ | — | — | ✓ | ✓ | |
| `/tsqa` | — | — | — | — | — | ✓ | ✓ | |
| `/supplier/*` | — | — | — | — | ✓ | — | — | Admin bypass disabled |
| `/admin/*` | — | — | — | — | — | ✓ | — | |

**Director logistics bypass:** `approver` + position `Director` may also access `/grn`, `/rfq`, `/pr2`, `/po`, `/delivery` (read/operate logistics modules). Finance Director does **not** get this bypass.

Source: `config/route-access.ts` → `DIRECTOR_LOGISTICS_PREFIXES`, `isDirectorApprover()`

---

## 4. Sidebar Module Access (Default)

| Module | employee | warehouse | procurement | approver | supplier | admin | tsqa |
|--------|:--------:|:---------:|:-----------:|:--------:|:--------:|:-----:|:----:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (/tsqa) |
| My Requests (PR1) | ✓ | — | — | — | — | — | — |
| Delivery Status | ✓ | ✓ | ✓ | — | — | — | — |
| Substitute Review | ✓ | — | — | — | — | — | — |
| Warehouse Queue | — | ✓ | — | — | — | — | — |
| Goods Receipt (GRN) | — | ✓ | ✓ | — | — | — | — |
| Warehouse History | — | ✓ | — | — | — | — | — |
| PR2 Requests (approvals) | — | — | ✓ | — | — | — | — |
| Canvassing / RFQ | — | — | ✓ | — | — | — | — |
| Purchase Orders | — | — | ✓ | — | — | — | — |
| Supplier Accreditation | — | — | ✓ | — | — | — | — |
| Product Review | — | — | ✓ | — | — | — | — |
| Approval Queue | — | — | ✓ | — | — | — | — |
| Approval History | — | — | ✓ | ✓ | — | — | — |
| PR1 Requests (approvals) | — | — | — | ✓ | — | — | — |
| PR2 Requests (approvals) | — | — | — | ✓ | — | — | — |
| PO Approvals | — | — | — | ✓ | — | — | — |
| Supplier Quotations | — | — | — | — | ✓ | — | — |
| Supplier PO | — | — | — | — | ✓ | — | — |
| Supplier Deliveries | — | — | — | — | ✓ | — | — |
| Product Catalog | — | — | — | — | ✓ | — | — |
| Supplier Accreditation (portal) | — | — | — | — | ✓ | — | — |
| RSE Queue | — | — | — | — | — | — | ✓ |
| Admin modules | — | — | — | — | — | ✓ | — |

**Module visibility override:** Admin can hide/show modules per role+position via `/admin/module-visibility`. This affects sidebar only — does not change route access or RLS.

---

## 5. Workflow Approval Authority

### PR1_APPROVAL

| Step | Role | Position | Action Label | Final? |
|------|------|----------|--------------|--------|
| 1 | approver | Supervisor | Reviewed and Noted By | No |
| 2 | approver | Department Head | Approved By | **Yes** |

### PR2_PHASE1 (current — post `20260526120000`)

| Step | Role | Position | Action Label | Final? |
|------|------|----------|--------------|--------|
| 1 | procurement | Procurement Staff | Prepared By | No |
| 2 | procurement | Procurement Manager | Reviewed By | No |
| 3 | approver | Director | Approved By | **Yes** |

**Verified:** No Supervisor, no Department Head, no Finance Director in PR2 Phase 1.

### PR2_PHASE2

| Step | Role | Position | Action Label | Final? |
|------|------|----------|--------------|--------|
| 1 | procurement | Buyer | Prepared By | No |
| 2 | procurement | Procurement Manager | Reviewed By | No |
| 3 | approver | Director | Approved By | **Yes** |

### PO_APPROVAL

| Step | Role | Position | Action Label | Final? |
|------|------|----------|--------------|--------|
| 1 | procurement | Buyer | Prepared By | No |
| 2 | procurement | Procurement Manager | Reviewed By | No |
| 3 | approver | Finance Director | Approved By | **Yes (internal)** |
| 4 | supplier | Supplier Representative | Received By | Supplier acknowledgment |

Step 4 is recorded on PO acknowledgment (`lib/po-approvals.ts`), not via standard internal approval action.

---

## 6. Data-Level Permissions (RLS Summary)

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| PR1 | Employee (own) | Scoped: requisitioner, warehouse, procurement, approver-with-instance, supplier-on-RFQ | Owner (draft); warehouse (validation); approvers (approval); procurement (priority) | Owner (draft only) |
| Warehouse validation | Warehouse | Scoped via `can_read_warehouse_validation` | Warehouse | — |
| RFQ | Procurement | Procurement; supplier (assigned); requestor (own PR1); Director | Procurement; supplier (own quotes) | Procurement |
| PR2 | Procurement (generate) | Procurement; approver; requestor (own) | Procurement; approver (status on approval) | — |
| PO | Procurement (Buyer) | Procurement; approver; supplier (own approved/sent); employee (own PR1) | Procurement; approver; supplier (ack) | — |
| Delivery | System (on PO ack) | Role-scoped | Supplier (own); warehouse; procurement | — |
| GRN | Warehouse | Warehouse; procurement; approver; employee (own) | Warehouse | — |
| Supplier accreditation | Supplier (own) | Supplier; procurement; admin | Supplier (draft/submit/withdraw); procurement (review) | — |
| Supplier products | Supplier (own) | Supplier; procurement; admin; TSQA (pending) | Supplier (draft); procurement; TSQA (verdict) | — |
| RSE | Procurement | Procurement; TSQA (assigned); supplier (own) | Procurement; TSQA (assigned) | — |
| Audit logs | Any authenticated (INSERT) | Admin only (SELECT) | — | — |
| Notifications | Any authenticated (INSERT) | Own (SELECT/UPDATE) | Own (mark read) | — |

---

## 7. Commercial Price Visibility

Source: `lib/price-visibility.ts`

| Can View Unit/Total Prices | Cannot View (shows "Price hidden") |
|----------------------------|-------------------------------------|
| `admin` | `employee` |
| `procurement` (all positions) | `warehouse` |
| `approver` + Director | `supplier` (on some views) |
| `approver` + Finance Director | `tsqa` |
| | Other approver positions (Supervisor, Dept Head) |

---

## 8. Admin Capabilities

| Module | Route | Capabilities |
|--------|-------|--------------|
| User Management | `/admin/users` | Create, invite, reset password, assign role/dept/position, deactivate, reactivate |
| Roles | `/admin/roles` | View roles with user counts (read-only) |
| Positions | `/admin/positions` | Create, edit, deactivate, reactivate |
| Departments | `/admin/departments` | Create, edit, deactivate, reactivate |
| Workflows | `/admin/workflows` | Edit approval workflow steps (order, role, position, label) |
| Module Visibility | `/admin/module-visibility` | Toggle sidebar modules; borrow modules from other roles |
| Audit Logs | `/admin/audit` | View system audit trail (admin read-only) |

**Not audited in system:** Role CRUD (roles table is read-only in UI). User create/invite actions do not write audit logs. User deactivate/reactivate writes `USER_DEACTIVATED` / `USER_REACTIVATED` to `audit_logs`.

---

## 9. Restrictions by Role

| Role | Key Restrictions |
|------|------------------|
| employee | PR1 detail: own requests only (`lib/pr1-access.ts`); no approval authority; no commercial pricing |
| warehouse | Cannot create PR1; cannot access RFQ/PR2/PO; no approval authority |
| procurement | PR2 Phase 1 final step = Director (not procurement); PO final internal = Finance Director |
| approver | Must match exact position for workflow step; Supervisor/Dept Head cannot approve PR2 |
| supplier | Isolated to own data; cannot access internal routes; admin cannot bypass supplier portal |
| admin | Cannot access `/supplier/*`; no workflow approval steps seeded for admin role |
| tsqa | RSE evaluation only; does not approve supplier accreditation; redirected from `/dashboard` to `/tsqa` |

---

## 10. Permission Inconsistencies (Flagged)

| Issue | Detail |
|-------|--------|
| Module visibility ≠ security | Hidden modules can still be accessed via direct URL if route allows |
| Notification INSERT permissive | Any user can create notifications for any user_id |
| PR2 Phase 1 label mismatch | User expectation (Supervisor/Finance Director) differs from code (Proc Staff/Proc Mgr/Director) |
| `types/database.ts` gap | 17 tables missing from TypeScript types — risk for developer errors |
| Director vs Finance Director | Only Director gets logistics route bypass; Finance Director gets commercial pricing only |
