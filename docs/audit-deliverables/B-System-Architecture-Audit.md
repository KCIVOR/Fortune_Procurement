# Document B — System Architecture Audit
## Fortune Procurement System

**Audit Date:** June 6, 2026  
**Audit Method:** Static code analysis — application source, Supabase migrations (114 files), configuration  
**Live Database Verification:** Not performed (schema verified from migrations only)

---

## 1. Executive Summary

| Attribute | Verified Finding |
|-----------|------------------|
| **Application Name** | Fortune Procurement System (UI: "Procurement System") |
| **Purpose** | End-to-end procurement: PR1 → warehouse validation → approval → RFQ → PR2 → PO → delivery → GRN |
| **Framework** | Next.js 13.5.1 (App Router), React 18, TypeScript |
| **Database** | Supabase PostgreSQL with Row Level Security (RLS) on all 41 public tables |
| **Auth** | Supabase Auth (email/password), cookie sessions via `@supabase/ssr` |
| **Business Logic Layer** | Client-side `lib/*.ts` modules calling Supabase directly (no server actions) |
| **Privileged Operations** | 7 Next.js API routes + 3 Supabase Edge Functions (service role) |

**Evidence:** `package.json`, `app/layout.tsx`, `supabase/migrations/`, `lib/`

---

## 2. Technology Stack

| Layer | Technology | Evidence |
|-------|------------|----------|
| Frontend | Next.js 13.5.1, React 18, Tailwind CSS 3, Radix UI, shadcn/ui | `package.json`, `components/ui/` |
| Backend / DB | Supabase PostgreSQL, Auth, Storage, Edge Functions | `lib/supabase.ts`, `supabase/` |
| Forms | react-hook-form, zod | `package.json` |
| Email | Brevo API (`BREVO_API_KEY`) | `app/api/*/send-email/route.ts` |
| Charts | recharts | `package.json`, dashboard components |
| File Storage | Supabase Storage buckets | migrations `20260507000300`, `20260506093000`, `20260520110000` |

---

## 3. Application Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (React Client)                       │
│  app/**/*.tsx  │  components/**  │  context/AuthContext.tsx    │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│  lib/*.ts       │ │  middleware.ts  │ │  app/api/** (7)      │
│  (Supabase      │ │  route-access   │ │  Edge Functions (3)  │
│   client + RLS) │ │  + session      │ │  (service role)      │
└────────┬────────┘ └────────┬────────┘ └──────────┬───────────┘
         │                   │                      │
         └───────────────────┼──────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL + Auth + Storage)              │
│  41 tables │ RLS policies │ triggers │ RPC functions            │
└─────────────────────────────────────────────────────────────────┘
```

**Key design decision:** Most mutations run client-side with the user's JWT; RLS enforces authorization. API routes are used only for admin user management, email sending, and password reset.

---

## 4. Security Architecture

### 4.1 Authentication

| Mechanism | Implementation |
|-----------|----------------|
| Login | `supabase.auth.signInWithPassword` — `app/login/page.tsx` |
| Session | Cookie-based via `@supabase/ssr` — `lib/supabase/middleware.ts` |
| Invite flow | Admin invite → email link → `/invite/complete` — `lib/auth-email-link-session.ts` |
| Password reset | `/forgot-password` → email → `/reset-password` |
| Remember me | `localStorage.rememberMe` vs `sessionStorage.tempSession` — `context/AuthContext.tsx` |

### 4.2 Authorization Layers

| Layer | File | Scope |
|-------|------|-------|
| Middleware | `middleware.ts` | Page routes only (`/api/*` excluded) |
| Route RBAC | `config/route-access.ts` | Role + Director logistics bypass |
| Page guards | Individual pages + `hooks/use-require-roles.ts` | Client-side AccessDenied |
| Module visibility | `lib/module-visibility.ts` | Sidebar only — **not security** |
| RLS | 114 migration files | Data-level access control |
| Workflow steps | `lib/approvals.ts`, `lib/pr2-approvals.ts`, `lib/po-approvals.ts` | Exact role + position match |

### 4.3 Supplier Isolation

- `supplier_id = auth.uid()` on RFQ, PO, delivery, accreditation, product tables
- `/supplier/*` routes: `adminBypass: false` — admin cannot access supplier portal
- BEFORE triggers restrict supplier field writes — `20260507120000_tighten_supplier_accreditation_product_rls.sql`

### 4.4 File Upload Security

| Bucket | Max Size | Allowed Types | Path Pattern |
|--------|----------|---------------|--------------|
| `accreditation-docs` | 20 MB | PDF, JPG, PNG | UUID-based paths |
| `delivery-receipts` | 10 MB | PDF, JPG, PNG | Private bucket |
| `message-attachments` | 10 MB | Images, PDF, Office | Max 5 per message |

### 4.5 Security Findings (Flagged)

| # | Issue | Severity |
|---|-------|----------|
| 1 | `notifications` INSERT RLS allows any authenticated user to notify any `user_id` | High |
| 2 | `audit_logs` INSERT RLS allows any authenticated user to insert rows | Medium |
| 3 | `/api/bugtrack/send-email` — any authenticated user can trigger admin inbox email | Medium |
| 4 | Middleware does not protect `/api/*` — per-route auth only | Info |
| 5 | `ip_address` audit column never populated | Low |
| 6 | No audit retention/purge policy | Medium |
| 7 | User create/invite not audited (assignment/password reset are) | Medium |
| 8 | Duplicate admin auth implementations (API inline, `api-auth.ts`, edge `admin-auth.ts`) | Medium |
| 9 | Unused `create-user` edge function (API route used instead) | Low |

---

## 5. Roles & Positions (Verified)

**7 roles:** `employee`, `warehouse`, `procurement`, `approver`, `supplier`, `admin`, `tsqa`  
**14 positions:** Staff, Warehouse Staff, Warehouse Manager, Procurement Staff, Authorized Personnel, Buyer, Procurement Manager, Supervisor, Department Head, Director, Finance Director, Supplier Representative, System Administrator, TSQA Staff

**8 departments (seeded):** EXEC, FIN, OPS, IT, HR, PROC, WH, GS

Source: `types/auth.ts`, `20260423215953_foundation_schema.sql`

---

## 6. Approval Workflows (Current State)

| Workflow Code | Steps | Positions (verified from `20260526120000_remove_pr2_phase1_dept_head.sql`) |
|---------------|-------|-------------------------------------------------------------------------------|
| `PR1_APPROVAL` | 2 | Supervisor → Department Head (final) |
| `PR2_PHASE1` | **3** | Procurement Staff → Procurement Manager → Director (final) |
| `PR2_PHASE2` | 3 | Buyer → Procurement Manager → Director (final) |
| `PO_APPROVAL` | 4 | Buyer → Procurement Manager → Finance Director (final internal) → Supplier Rep (acknowledgment) |

**Correction:** PR2 Phase 1 no longer includes Department Head (removed in migration `20260526120000`). Previous `docs/SYSTEM_AUDIT.md` section 8.2 is outdated.

---

## 7. API Surface

### Next.js API Routes (7)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/admin/users/create` | Admin JWT | Create user with temp password |
| `POST /api/admin/users/invite` | Admin JWT | Supabase invite email |
| `PATCH /api/admin/users/[id]/assignment` | Admin JWT | Update role/dept/position |
| `POST /api/admin/users/[id]/reset-password` | Admin JWT | Reset password via edge function |
| `POST /api/rfq/send-email` | Procurement JWT | Brevo RFQ invitation emails |
| `POST /api/bugtrack/send-email` | Any authenticated | Bug report email to admin |
| `POST /api/bugtrack/send-resolved-email` | Admin JWT | Bug resolved notification |

### Supabase Edge Functions (3)

| Function | Auth | Status |
|----------|------|--------|
| `reset-user-password` | Admin JWT | Active — called from API |
| `reset-demo-passwords` | Admin JWT + env flag | Dev/demo only |
| `create-user` | Admin JWT | **Unused** — duplicate of API route |

### Client-Side Business Modules (44 `lib/*.ts` files)

Primary domains: `pr1.ts`, `warehouse.ts`, `approvals.ts`, `canvassing.ts`, `pr2.ts`, `pr2-approvals.ts`, `po.ts`, `po-approvals.ts`, `delivery.ts`, `grn.ts`, `accreditation.ts`, `supplier-products.ts`, `rse.ts`, `tsqa.ts`, `notifications.ts`, `audit.ts`

---

## 8. Database Schema Summary

**41 public tables** — no PostgreSQL ENUM types (TEXT + CHECK constraints)

| Group | Tables | Count |
|-------|--------|-------|
| Identity & Governance | departments, roles, positions, profiles, role_position_module_visibility | 5 |
| Workflow Infrastructure | controlled_form_templates, controlled_form_versions, approval_workflows, approval_steps, approval_instances, approval_actions, notifications, audit_logs | 8 |
| PR1 & Warehouse | pr1_requests, pr1_items, warehouse_validations, warehouse_validation_items | 4 |
| RFQ / Canvassing | rfq_batches, rfq_suppliers, rfq_item_quotes, supplier_item_selections, substitute_decisions | 5 |
| PR2 | pr2_requests, pr2_items | 2 |
| PO | po_requests, po_items, po_receipts | 3 |
| Delivery & GRN | deliveries, delivery_status_history, grn_receipts, grn_items | 4 |
| Supplier Compliance | supplier_accreditations, supplier_products, supplier_documents, rse_records, tsqa_reviews | 5 |
| Platform | bug_reports, bugtrack_settings, conversations, messages, message_attachments | 5 |

**Orphan tables (infrastructure only):** `controlled_form_templates`, `controlled_form_versions` — seeded, FK-linked, not queried by application code.

**Type gap:** `types/database.ts` documents only 24 of 41 tables.

---

## 9. Route Inventory Summary

**72 pages** under `app/` — see Document F for complete inventory.

**Flagged routes:**
- `/test-dashboard`, `/test-filter` — dev-only, 404 in production
- `/admin` — orphan (duplicates dashboard for admin role)
- `/messages/new` — orphan (superseded by inline UserSearch on `/messages`)

---

## 10. Platform Features (Verified)

| Feature | Implementation |
|---------|----------------|
| In-app notifications | `lib/notifications.ts`, `NotificationBell.tsx` |
| Messaging | 1:1 conversations, attachments, read receipts — `lib/messages.ts` |
| BugTrack | Internal bug reporting + email — `lib/bugtrack.ts` |
| Audit logs | Immutable trail, admin view — `lib/audit.ts` |
| Print views | PR1, PR2, PO, GRN printable pages |
| FilterBar | Search, tabs, filters, pagination — `components/shared/FilterBar.tsx` |
| Viber | Clipboard/share text formatter only — `lib/viber-utils.ts` (not automated delivery) |
| Module visibility | Per role/position sidebar toggles — admin configurable |

---

## 11. Features NOT Present (Verified Absent)

The following are **not implemented** in this codebase:

- Payroll, payslips, salary management
- Time & attendance, leave management
- Employee 201 file / HR lifecycle
- Performance management, appraisals
- Recruitment / ATS
- Training modules
- HR calendar, events, meetings
- General finance module (accounts, deposits, expenses)
- Assets management, general file manager
- CRM / client invoicing (no `client` role)
- Multi-language settings, mail server configuration UI

---

## 12. End-to-End Procurement Chain

```
Employee PR1 → Warehouse Validation → PR1 Approval (Supervisor → Dept Head)
  → RFQ/Canvassing → Substitute Review (if alternatives)
  → PR2 (Phase 1: Proc Staff → Proc Mgr → Director)
  → PR2 (Phase 2: Buyer → Proc Mgr → Director)
  → PO (Buyer → Proc Mgr → Finance Director → Supplier Ack)
  → Delivery Tracking → GRN (Goods Receipt)
```

**Parallel compliance track:** Supplier Accreditation → Product Catalog → RSE → TSQA Review

---

## 13. Audit Limitations

1. Live database not queried — row counts and runtime RLS behavior not verified
2. `.env.local` secrets not inspected
3. UI screenshots not captured — code-based audit only
4. Edge functions not execution-tested
5. `types/database.ts` incomplete vs live schema

---

## 14. Key Evidence Files

| Area | Path |
|------|------|
| App identity | `app/layout.tsx` |
| Navigation | `config/navigation.ts` |
| Route RBAC | `config/route-access.ts`, `middleware.ts` |
| Roles/positions | `types/auth.ts` |
| DB foundation | `supabase/migrations/20260423215953_foundation_schema.sql` |
| Workflow seed | `supabase/migrations/20260423221510_seed_workflow_definitions.sql` |
| PR2 Phase 1 fix | `supabase/migrations/20260526120000_remove_pr2_phase1_dept_head.sql` |
| Dashboards | `components/dashboards/` |
| Price visibility | `lib/price-visibility.ts` |
| Notifications | `lib/notifications.ts` |
| Audit | `lib/audit.ts` |
