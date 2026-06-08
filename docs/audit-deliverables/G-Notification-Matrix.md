# Document G — Notification Matrix
## Fortune Procurement System

**Source:** `lib/notifications.ts`, workflow lib modules, `app/api/*/send-email`, `notifications` table schema

**Delivery channels verified:** In-app (bell), Email (Brevo API), Supabase Auth email (invite only). Viber is clipboard/share only — not automated.

---

## 1. In-App Notification System

### Schema (`notifications` table)

| Field | Type | Purpose |
|-------|------|---------|
| `user_id` | uuid | Recipient |
| `title` | text | Notification title |
| `body` | text | Message body |
| `type` | text | `action_required`, `info`, `approved`, `rejected` |
| `document_type` | text | Linked entity type |
| `document_id` | uuid | Linked entity ID |
| `action_url` | text | Deep link for navigation |
| `read` | boolean | Read state |

**UI:** `components/layout/NotificationBell.tsx` — header bell icon with dropdown, mark read, mark all read.

**Deduping:** `notifyApproversForStep()`, `notifyByRole({ dedupeUnreadForDocument })`, and per-call existence checks prevent duplicate unread notifications for same document.

---

## 2. In-App Notification Triggers

### PR1 Lifecycle

| # | Trigger Event | Source | Recipient | Type | Message Template | action_url |
|---|---------------|--------|-----------|------|------------------|------------|
| 1 | PR1 submitted | `lib/pr1.ts` → `submitPR1` | All `warehouse` role | action_required | "PR1 {number} requires warehouse validation" | `/warehouse/{id}` |
| 2 | Warehouse sufficient | `lib/warehouse.ts` | PR1 requisitioner | info | "Request Fulfilled from Stock" | `/pr1/{id}` |
| 3 | Warehouse insufficient → approval | `lib/warehouse.ts` | Step 1 approvers (Supervisor) | action_required | PR1 approval default text | `/approvals/{instanceId}` |
| 4 | PR1 step advanced | `lib/approvals.ts` | Next-step approvers | action_required | "PR1 {number} requires your approval" | `/approvals/{id}` |
| 5 | PR1 final approved | `lib/approvals.ts` | Requisitioner + all `procurement` | approved / action_required | "PR1 {number} approved" / "ready for canvassing" | `/pr1/{id}` |
| 6 | PR1 rejected | `lib/approvals.ts` | Requisitioner | rejected | "PR1 {number} rejected" | `/pr1/{id}` |
| 7 | PR1 revision requested | `lib/approvals.ts` | Requisitioner | action_required | "PR1 {number} requires revision" | `/pr1/{id}/edit` |

### RFQ / Canvassing

| # | Trigger Event | Source | Recipient | Type | Message |
|---|---------------|--------|-----------|------|---------|
| 8 | RFQ issued | `lib/canvassing.ts` | Each invited supplier | action_required | "RFQ Issued" + RFQ number |
| 9 | Supplier quote submitted | `lib/canvassing.ts` | All `procurement` | action_required | "{supplier} submitted quotation for {PR1}" |
| 10 | Substitute items in quote | `lib/canvassing.ts` | Requisitioner + procurement | action_required | "Substitute items require your review" |
| 11 | Substitute decision made | `lib/canvassing.ts` | All `procurement` | info | "Substitute {accepted/rejected} for {PR1}" |
| 12 | RFQ closed | `lib/canvassing.ts` | Procurement + requisitioner | info | "Canvassing complete for {PR1}" |

### PR2

| # | Trigger Event | Source | Recipient | Type | Message |
|---|---------------|--------|-----------|------|---------|
| 13 | PR2 generated | `lib/pr2.ts` | Requisitioner | info | "PR2 Generated for your request" |
| 14 | PR2 submitted for approval | `lib/pr2-approvals.ts` | Phase 1 step 1 approvers | action_required | "PR2 {number} submitted for approval" |
| 15 | PR2 step advanced | `lib/pr2-approvals.ts` | Next-step approvers | action_required | "PR2 {number} requires your approval" |
| 16 | PR2 Phase 1 approved (auto Phase 2) | `lib/pr2-approvals.ts` | Phase 2 step 1 (Buyer) | action_required | "PR2 {number} Phase 2 approval required" |
| 17 | PR2 final approved | `lib/pr2-approvals.ts` | Requisitioner | approved | "PR2 {number} approved" |
| 18 | PR2 rejected / revision | `lib/pr2-approvals.ts` | Submitter (procurement) | rejected / action_required | "PR2 {number} rejected/revision requested" |

### PO

| # | Trigger Event | Source | Recipient | Type | Message |
|---|---------------|--------|-----------|------|---------|
| 19 | PO submitted for approval | `lib/po-approvals.ts` | Step 1 approvers (Buyer) | action_required | "PO {number} submitted for approval" |
| 20 | PO step advanced | `lib/po-approvals.ts` | Next-step approvers | action_required | "PO {number} requires your approval" |
| 21 | PO approved (Finance Director) | `lib/po-approvals.ts` | Supplier + requisitioner | action_required / approved | "New PO {number}" / "PO Approved" |
| 22 | PO rejected / revision | `lib/po-approvals.ts` | Submitter | rejected / action_required | "PO {number} rejected/revision requested" |

### Delivery & GRN

| # | Trigger Event | Source | Recipient | Type | Message |
|---|---------------|--------|-----------|------|---------|
| 23 | Delivery created (PO ack) | `lib/delivery.ts` | Requisitioner | info | "Delivery tracking started" |
| 24 | Delivery status updated | `lib/delivery.ts` | Requisitioner | info | "Delivery {status} for PO {number}" |
| 25 | Delivery completed | `lib/delivery.ts` | Requisitioner + all `warehouse` | info / action_required | "Delivery delivered" / "Ready for GRN" |
| 26 | GRN opened | `lib/grn.ts` | Requisitioner | info | "GRN started" |
| 27 | GRN closed | `lib/grn.ts` | Requisitioner | approved | "GRN closed" |

### Supplier Compliance

| # | Trigger Event | Source | Recipient | Type | Message |
|---|---------------|--------|-----------|------|---------|
| 28 | Accreditation submitted | `lib/accreditation.ts` | All `procurement` | action_required | "{supplier} submitted accreditation" |
| 29 | Accreditation withdrawn | `lib/accreditation.ts` | All `procurement` | info | "Accreditation withdrawn" |
| 30 | Missing documents requested | `lib/accreditation.ts` | Supplier | action_required | "Additional documents required" |
| 31 | Accreditation approved/rejected | `lib/accreditation.ts` | Supplier | approved / rejected | Review outcome + notes |
| 32 | Product submitted for review | `lib/supplier-products.ts` | All procurement | action_required | "{product} submitted for review" |
| 33 | Product verified/rejected | `lib/supplier-products.ts` | Supplier | approved / rejected | Review outcome |
| 34 | New product via RFQ | `lib/supplier-products.ts` | Procurement | action_required | "New product proposal from {supplier}" |
| 35 | RSE created | `lib/rse.ts` | Assigned TSQA (if set) | action_required | "RSE {number} assigned to you" |
| 36 | RSE assigned | `lib/rse.ts` | Assigned TSQA user | action_required | "RSE {number} assigned" |
| 37 | TSQA result recorded | `lib/tsqa.ts` | Supplier + procurement | approved / rejected | "Product {passed/failed} TSQA review" |

---

## 3. Email Notifications

| # | Trigger | Route / Source | Auth Required | Recipient | Provider | Template Source |
|---|---------|----------------|---------------|-----------|----------|-----------------|
| E1 | Bug reported | `POST /api/bugtrack/send-email` | Any authenticated | `bugtrack_settings.notification_email` | Brevo | Inline HTML in route |
| E2 | Bug resolved | `POST /api/bugtrack/send-resolved-email` | Admin | Email from request body | Brevo | Inline HTML in route |
| E3 | RFQ issued | `POST /api/rfq/send-email` | Procurement | Supplier emails (from caller) | Brevo | Inline HTML in route |
| E4 | User invited | `POST /api/admin/users/invite` | Admin | Invited user email | Supabase Auth | Supabase Dashboard template |
| E5 | Password reset | Supabase Auth | Public (forgot-password page) | User email | Supabase Auth | `docs/email-templates/reset-password.html` |

**Email sender:** Hardcoded `johndaveb892@gmail.com` in Brevo routes.

**Environment:** `BREVO_API_KEY` required for E1–E3.

---

## 4. Events WITHOUT Notifications

| Event | Notes |
|-------|-------|
| New message received | `lib/messages.ts` — no in-app notification created |
| User created (admin) | No notification or audit log |
| User invited | Supabase email only, no in-app |
| Warehouse validation saved (draft) | No notification until submit |
| GRN progress saved | No notification until close |
| Procurement follow-up note on delivery | History only, no notification |
| Viber share | Manual clipboard action on RFQ detail page |

---

## 5. Notification Helper Functions

| Function | File | Purpose |
|----------|------|---------|
| `createNotification()` | `lib/notifications.ts` | Insert single notification |
| `notifyByRole()` | `lib/notifications.ts` | Fan-out to all users with given role |
| `notifyApproversForStep()` | `lib/notifications.ts` | Fan-out to users matching workflow step role+position |
| `notifyAllProcurementUsers()` | `lib/supplier-products.ts` | Local copy for product events |
| Local `notifyByRole` copies | `lib/accreditation.ts`, `lib/rse.ts`, `lib/tsqa.ts` | Duplicated helper (inconsistency flagged) |

---

## 6. Security Notes

| Issue | Detail |
|-------|--------|
| Permissive INSERT RLS | Any authenticated user can INSERT notifications for any `user_id` |
| Bug email trigger | Any authenticated user can send email to admin bug inbox |
| No notification retention | Notifications accumulate indefinitely; no purge policy |
| No email for most workflow events | PR1/PR2/PO approvals are in-app only (except RFQ to suppliers) |

---

## 7. Appendix — Notification Type Usage

| Type | When Used |
|------|-----------|
| `action_required` | User must take action (approve, review, submit) |
| `info` | Informational update (status change, tracking) |
| `approved` | Positive outcome (approved, verified, GRN closed) |
| `rejected` | Negative outcome (rejected, failed) |
