# Fortune Procurement System — Complete Feature & Function Reference

**Every feature the system has, and the context it operates in — verified directly against the working code, not assumed.**

---

## How to Read This Document

Every feature listed below was confirmed by reading the actual screens, business logic, and database rules that implement it. Where a limit is stated (a file size, a count, a required field), it is the exact value enforced by the system, not an approximation. Where a feature has a limitation, an inconsistency, or something that looks unfinished, it is called out explicitly in a **Note** — this document does not smooth those over.

The document has two parts:
1. **Part A — Complete Feature Catalog**, organized by functional area.
2. **Part B — Context of the System**, explaining what the system is, who it serves, and the business problem it solves.

---

# Part A — Complete Feature Catalog

## 1. Request Intake

### 1.1 Employee Purchase Request (PR1)
- Any Employee can create a **PR1** — the entry-point request for Goods or Services.
- Auto-filled: requestor name, department, date created.
- Required fields: **Purpose** (dropdown of configurable purposes, with an "Other" free-text fallback), **Date Required**, **Priority** (Normal / Medium / High — required on every PR1).
- Line items: description, unit of measure, quantity. Each line can be flagged **Raw Mat.** if it's a production raw material (this flag affects downstream QA handling later, at GRN).
- Each line item supports its own **file attachment** (photo, spec sheet, or quote).
- **Save Draft** (editable, deletable) or **Submit** (enters the approval flow; can no longer be edited or deleted directly by the requestor — only a "Request Revision" from an approver returns it to an editable state).
- Full item-level history and a status timeline are visible on the detail page at all times.
- **Print** produces a clean, formatted copy of the PR1.

### 1.2 Planning-Direct Request (PR2, no PR1)
- Users in the **Planning Staff** position can skip PR1 entirely and create a **PR2 directly**, for **Raw Materials** or **Services**, because Planning's requests are based on production forecasting rather than a stock check.
- Same core fields as a PR1 (requestor, purpose, date required, priority, line items), entered directly into the PR2 form.
- This request bypasses Warehouse's stock-check step entirely and goes straight into PR2 internal certification.
- Planning's own request list ("My Requests" for that position) shows the full downstream lifecycle of each request — not just its internal approval status, but whether it's since had a Purchase Order sent, a delivery in progress, or a completed Goods Receipt — computed live from the linked PO/Delivery/GRN records.

### 1.3 Warehouse Stock Validation (for PR1s only)
- Every submitted, approved PR1 lands in Warehouse's **Validation Queue**.
- For each line item, Warehouse enters the **Verified Stock on Hand** — the system automatically marks the line **Sufficient** or **Insufficient** by comparing it to the requested quantity.
- Warehouse may adjust the requested quantity to reflect a partial fulfillment; any such change requires an explanatory note.
- **Save Progress** at any point without finalizing; **Submit Warehouse Validation** when done.
- Items marked Sufficient are fulfilled internally, with no purchase created. Items marked Insufficient are automatically bundled into a **PR2** that Warehouse creates and is recorded as "Prepared By" on — this is the handoff into the purchasing process.
- A single PR1 can produce a partial-fulfillment outcome (some lines filled from stock, others routed to Procurement) in one validation pass.
- Every validation performed is retained in **Warehouse History**, searchable and filterable.

---

## 2. PR2 — Internal Certification

- Regardless of how the PR2 was created (Warehouse handoff or Planning-direct), it enters the same two-step internal sign-off before Procurement may source suppliers:
  1. **Department Head** certifies it ("Certified By").
  2. **Operations Manager** gives final approval ("Approved By") — this automatically notifies Procurement that sourcing may begin.
- Some approval steps can be configured (by Admin) to apply only within a value threshold — e.g., a step that only triggers above a certain purchase amount; if the request doesn't meet the threshold, that step is skipped automatically.
- If a PR2 is later rejected/reopened for revision and superseded by a fresh PR2, the old one is retained in an **archived, read-only** state — fully viewable for history, but with no further action possible on it.
- The PR2 detail view shows a Subtotal / VAT / Total breakdown once pricing exists (post-canvassing), not before.

---

## 3. Sourcing & Canvassing (RFQ)

- Procurement creates an **RFQ (Request for Quotation)** against an approved PR2 — the RFQ is a continuation of the PR2's process, not an independent document; there is no path to create a PR2 from an RFQ.
- Suppliers are invited two ways:
  - Existing **accredited suppliers** registered in the system, or
  - A one-off **external vendor** (e.g., a marketplace or walk-in store with no system account) — added by name only. External vendors have no login, no invite/response cycle: Procurement enters their quote manually on their behalf, and they're excluded from all system notifications and emails (there's genuinely no account to notify). Removing an external vendor is only possible while the RFQ is still in Draft and no quote has been entered for them yet.
- Line items and specifications carry over from the PR2 automatically. A **closing date** is set, and the RFQ is sent — all invited (non-external) suppliers are notified in-app and by email.
- As quotations arrive, they appear in a **side-by-side comparison table** — one column per supplier, one row per item — showing price, lead time, and any attached files.
- **Awarding**: Procurement picks the winning quote per line item. Changing the underlying quote after it was awarded automatically clears the award, so a stale decision is never silently kept. Awarded prices and totals are written back onto the PR2's own items.
- **Substitute items** (see §10) can surface here when a supplier can't fulfill the exact spec.
- Once satisfied, Procurement **Closes** the RFQ, then submits it for its own two-step sign-off — **Procurement Manager** reviews, **Director** gives final approval (labeled "Canvassing sign-off" on the PR2 record). Only after this approval can a Purchase Order be generated.
- **Note (verified against real data during this project's work):** suppliers invited to a **Planning-direct** RFQ previously never received a notification or email when the RFQ was issued — this has since been corrected; both Employee-originated and Planning-direct RFQs now notify suppliers identically.

---

## 4. Purchase Orders (PO)

- **Generate PO** from a PR2 whose canvassing sign-off is approved — supplier and line items pre-fill automatically.
- Each supplier (including each external vendor) always gets **its own separate PO** — orders are never merged across suppliers, even when they came from the same RFQ.
- Editable at creation: PO number (custom entry allowed), **payment terms** (dropdown, defaulted from the supplier's profile but changeable), delivery address/instructions, remarks.
- **Save as Draft**, or **Submit for Approval** to enter the PO's three-step internal approval chain: **Buyer/Procurement Staff → Procurement Manager → Finance Director** (Finance Director is the final internal approval).
- After full internal approval, the PO is **not** sent automatically — Procurement must manually click **Send to Supplier**, a deliberate safeguard against anything going out the door unattended.
- **External-vendor POs** skip the "send to supplier" step entirely (there's no portal to send it to) — Procurement places the order directly (phone/email/in person) and clicks **Mark as Ordered** to reflect that manually.
- Status progression: **Draft → For Approval → Sent to Supplier → Delivered.**
- Subtotal / VAT / Total breakdown shown whenever VAT applies (see §13.5).
- Full search, filter, and **Print** support on the PO list and detail page.

---

## 5. Supplier Portal

The supplier's experience is entirely separate from internal staff and scoped strictly to their own company's records. Which extra screens a supplier sees depends on their assigned **supply type**: **Raw Material** suppliers get a Product Catalog; **Service** suppliers get a Compliance Documents page; **Normal** (ordinary goods) suppliers get neither.

### 5.1 Accreditation
Before a supplier can transact at all, they must be accredited.
- **Start Accreditation Application** — blocked if a non-rejected application already exists.
- **Upload Document**, choosing a document type (Company Profile, Self Assessment, Legal Document, Certification, Technical Data Sheet, MSDS/Safety Data Sheet, Product Specification, Other). Files: PDF/JPG/PNG, max **10 MB**, up to **3 files per document type**.
- **Submit for Procurement Review** once documents are in.
- Status path: **Draft → Submitted → Under Review → (Missing Documents, if something needs fixing) → Approved | Rejected | Withdrawn | Expired.**
- **Withdraw Application** is available at Draft, Submitted, or Missing Documents stages.
- Once a document is individually flagged **Needs Revision** or **Rejected** by Procurement, the supplier can **replace/resubmit** just that file.
- Each accredited document carries its **own expiry date** (not one expiry for the whole application) — Procurement sets this when verifying a document, and the system tracks 60/30/15/0-day reminders per document as it approaches expiry.
- Procurement-side actions: mark **Under Review**, **Request Missing Documents** (with a note), **Approve**, **Reject** (with notes), **Revoke** an approved accreditation (reason required — this moves it to Expired), **Reopen for Review**, and edit an approved document's expiry date directly.

### 5.2 Product Catalog (Raw Material suppliers only)
- **Important:** the catalog is maintained **by Procurement on the supplier's behalf**, not by the supplier. A supplier can view their listed products (code, category, price, stock, and status) and open any product for its full verification history, but cannot add, edit, or submit a product themselves — that ability was deliberately removed; if a supplier needs a change, they contact Procurement.
- Only products marked **Verified** are selectable when submitting a quote.
- Status path: Submitted → Under Review → (Pending TSQA, in some cases) → Verified | Rejected, plus Inactive / Withdrawn / Expired as later states. Products no longer auto-expire on a schedule — expiry/deactivation is a manual Procurement action now.

### 5.3 Quotations (responding to an RFQ)
- The supplier's inbox has three tabs: **Awaiting Response, Submitted, Declined.**
- For each requested line, a supplier chooses one of three response modes:
  1. **Select a catalog product** — Raw Material suppliers only. Picking an unverified product shows an explicit warning that Procurement will see it as unverified and may require justification before it can be awarded. Picking a product whose type (Goods vs. Services) doesn't match the RFQ triggers a confirmation dialog before it's allowed.
  2. **Manual entry** — a free-text description, price, and lead time with no catalog link; available to every supplier regardless of supply type.
  3. **No Quote** — the supplier can't supply this line; a reason is required (a preset list — Not available, Not in product line, Cannot meet lead time, MOQ not met, Discontinued — or a free-text "Other").
- Any quoted line (catalog or manual) can be flagged as an **Alternative/substitute item**, which routes it to the requestor or Procurement for a side-by-side accept/reject decision (§10).
- **VAT selection** (VAT-Inclusive / VAT-Exclusive) appears only for suppliers registered as VAT-able, and is required when it appears.
- Supporting files can be attached per quote.
- **Submit Quotation** (relabeled **Update Quotation** on resubmission — a quote stays editable until the RFQ closes; note that editing an already-awarded quote clears that award). No further edits are possible once the RFQ closes.

### 5.4 Purchase Orders (supplier side)
- View every PO issued, with status **Awaiting Acknowledgment** or **Acknowledged**.
- **Acknowledge** with an optional commitment date and delivery remarks — this can be updated again later if plans change (each update overwrites the prior acknowledgment).
- Full item pricing and VAT breakdown are visible here (unlike the delivery screen, where pricing is deliberately hidden).

### 5.5 Delivery Management (supplier side)
- Update status along the path: **Pending → Scheduled → In Transit → Delayed → Delivered** (with **Cancelled** as a separate terminal state) — only the specific next statuses valid from the current one are offered, so a delivery can't jump illogically (e.g., Pending can move to Scheduled, In Transit, or Delayed, but not straight to Delivered).
- A **Delivery Receipt (DR)** file can be uploaded specifically at the point of moving to In Transit (PDF/JPG/PNG, max 10 MB).
- A note is **required** when marking a delivery Delayed, to explain the delay.
- Item pricing is intentionally not shown to the supplier on this screen. A full update-history timeline is visible to everyone tracking the delivery.

### 5.6 Compliance Documents (Service suppliers only)
- For services requiring supporting paperwork (e.g., a Certificate of Calibration), the supplier uploads it here — but only once a linked PO item has actually reached the receiving stage (a GRN must exist for that item first; the system will not accept an upload before then).
- Accepted formats: PDF/JPG/PNG/WEBP/DOC/DOCX, max 10 MB, **up to 3 files per item.**
- The supplier can delete their own upload if needed.

---

## 6. Delivery Tracking (viewing)

- Every role with visibility into a request can see live delivery status, grouped by **All / Pending / Scheduled / In Transit / Delayed / Delivered**, with search by PO number, supplier, or warehouse.
- Requestors and Warehouse see this as a **read-only** screen — the supplier is the only party who updates status (§5.5). Pricing is hidden from non-Procurement viewers here.
- Procurement has full visibility across every delivery company-wide, not just their own requests.

---

## 7. Receiving — Goods Receipt (GRN) & Quality Approval

### 7.1 Warehouse (Goods & Raw Materials) / Procurement (Services)
- Deliveries are received and inspected against the supplier's paperwork item by item. Recorded per line: quantity actually received, any discrepancy with a note, and any rejected quantity with a reason (rejected items are not considered received and are noted directly on the supplier's Delivery Receipt).
- A GRN stays **Open** while items are still arriving, allowing multiple receiving passes against the same PO.
- **Quality flagging**: any goods line can be manually **"Forward to QA"** at Warehouse's discretion (a case-by-case call). Every **Raw Material** line is **automatically and mandatorily** flagged for QA — this is not optional and cannot be turned off.
- Whenever any flagged line is unresolved, the whole GRN's status becomes **Pending QA** (a third status alongside Open/Closed) and TSQA is notified. The GRN **cannot be closed** while anything remains pending QA.
- **Close GRN** once every line — including all QA sign-offs — is resolved; a closed GRN can later be reopened by Warehouse or Procurement if a correction is needed. **Print** produces the finalized copy.
- For **Services**, Procurement (not Warehouse) performs this same receiving/closing role, since there's nothing physical to inspect — and if the service requires compliance documentation, receipt cannot be finalized until that document is uploaded (§5.6).

### 7.2 TSQA — Quality Approval
- TSQA's queue shows every GRN line currently awaiting their sign-off — both mandatory (raw material) and discretionary (flagged goods) lines.
- **Approve** clears the line for receipt. **Reject** requires a written reason and immediately notifies Warehouse that the item failed QA and is blocking GRN closure.
- A decision can be reversed later (Approve after a prior Reject, and vice versa) **as long as the GRN itself is still open** — once the GRN is closed, QA decisions on it are locked permanently.
- **Note:** there is no supplier-facing "resubmit after QA rejection" flow in the system today — a rejected raw material blocks the GRN until TSQA itself changes the decision to Approved; there's no separate corrective-action step routed back to the supplier.

---

## 8. Supplier Management (Procurement-facing)

- **Supplier Accounts**: full roster of registered suppliers, with search and a detailed profile/history view per supplier.
  - **Add Supplier** creates one account at a time (name, email, payment terms).
  - **Bulk Import** creates many accounts from a spreadsheet — download a template, upload `.csv`/Excel (up to 500 rows), map columns (Email and Supplier Name required, Payment Terms optional), preview before committing, and set one shared temporary password for the whole batch (or auto-generate one). A results screen reports exactly how many succeeded and why any row failed (e.g., duplicate email).
  - Each supplier's **VAT-registered** status and **supply type** (Normal / Raw Material / Service) are set here, controlling what they'll be asked for during quoting and which extra portal screens they see.
- **Accreditation queue**: review and decide on incoming applications (§5.1, procurement side).
- **Product Review**: since Procurement now owns the raw-material catalog, this is also where new products get entered on a supplier's behalf, and where submitted products are Verified or Rejected.

---

## 9. Compliance Documents (Procurement-facing tracking)

- **Note:** this is a document-tracking screen, not an approval workflow — there is no accept/reject/verify decision for a compliance document once uploaded; it is simply present or not.
- Any services PO line can be flagged by Procurement as **requiring a compliance document**.
- Per flagged item, status is computed live as **Awaiting GRN** (nothing can be uploaded yet — no GRN exists for it) → **Pending Upload** (GRN exists, nothing uploaded) → **Uploaded**. A PO's overall status reflects the "worst" status among its flagged items.
- The list view gives stat counts (Flagged POs / Awaiting GRN / Pending Upload / Uploaded) and search/filter by PO or supplier. The detail view is read-only with a download link per uploaded document — deleting an uploaded document is only available to the uploading supplier (or an Admin), not to Procurement from this screen.

---

## 10. Substitute Item Review

- Triggered whenever a supplier flags a quoted line as an **Alternative/substitute item** during quoting (§5.3) — no separate justification field is required from the supplier at that point beyond their normal quote remarks.
- The review screen shows a clear **"You requested" vs. "Supplier is offering"** side-by-side comparison, including any attached files. Pricing is intentionally hidden from the requestor at this stage — that's Procurement's call to make.
- **Either the original requestor or Procurement** can Accept or Reject — one party's decision is sufficient; the two do not both need to agree. An optional notes field captures the reasoning either way.
- If **Procurement** decides on behalf of a requestor, the requestor is notified their substitute was decided "on your behalf," and the UI marks it as such. If the **requestor** decides, Procurement is notified instead.
- A decision can be changed as long as it's still unlocked — it locks automatically once the RFQ closes/cancels, or once that line has already been awarded to a supplier.

---

## 11. Approvals — the Shared Engine

Every approval checkpoint across PR1, PR2, RFQ, and PO shares the exact same three-outcome model:

| Outcome | Effect |
|---|---|
| **Approve** | Advances to the next step or process stage |
| **Reject** | Closes the request; the requestor is told why |
| **Request Revision** | Sends it back one step for a fix, then it re-enters that same stage |

- **Approval Queue** — a single combined view of everything currently sitting at an approver's own step, across all four document types; nothing belonging to someone else's step is ever shown.
- **Approval History** — every action the current user has personally taken, tabbed by document type (All/PR1/PR2/PO/RFQ), with full remarks and timestamps, searchable by date range.
- **Department scoping**: Supervisor, Department Head, and Operations Manager positions only see requests from their own department. Director and Finance Director see company-wide, with no department restriction.
- **Directors** additionally get read-only visibility into Goods Receipt, Canvassing/RFQ, PR2, Purchase Orders, and Delivery Tracking — beyond just their approval queue — that other approver positions don't have.
- Some approval steps can be configured with a **value threshold**, applying only above/below a set amount; a request that doesn't meet the threshold skips that step automatically.

---

## 12. Administration

The most powerful role in the system — user, structural, and workflow configuration.

### 12.1 User Management
- Full user directory: name, email, role, department, position, active status — searchable and filterable.
- **Create a user directly** (with a temporary password, entered or auto-generated) or **invite by email** (they set their own password via an email link).
- **Edit assignment** — change a user's role, department, or position at any time; their menu and access update immediately.
- **Reset password** for a locked-out user (sets it directly, no email link needed).
- **Deactivate** an account (immediately blocks sign-in; the person's historical records are untouched) and **Reactivate** it later.
  - An Admin **cannot deactivate their own account**, and the system **blocks deactivating the last remaining active Admin** — there must always be at least one.
- A supplier-scoped "Default Payment Terms" field is editable from a user's edit page.
- **Note:** two additional supplier-profile controls (Supply Type and VAT-registered status) exist as working backend functions but are not currently wired into any Admin-visible screen — they're reachable today only through direct API calls, not through a button in the interface. **Procurement**, not just Admin, is separately permitted to toggle a supplier account's active status, payment terms, and (via those same backend functions) supply type / VAT status.

### 12.2 Roles, Positions & Departments
- **Roles** are fixed/system-defined and shown read-only (name + how many users hold it) — there is no create/edit/delete for roles themselves.
- **Positions** (e.g., "Procurement Manager") can be created, edited, deactivated, and reactivated. Deactivating one that's actively used in a live approval workflow step is blocked with a warning showing exactly how many workflow steps and users reference it.
- **Departments** can be created, edited, deactivated, and reactivated. Deactivating one with active users shows exactly how many people would be affected before confirming.
- None of these support permanent deletion — only deactivation, which preserves all historical data.

### 12.3 Approval Workflow Configuration
- For each configured workflow (e.g., "PR1 Approval," "PO Approval"), Admin can view a visual diagram of its steps and:
  - **Add a step**: order number, role required, position required, an action label (e.g., "Reviewed By"), and whether it's the final step.
  - Add a **threshold step**, active only within a value range.
  - **Edit** an existing step.
  - **Delete** a step — blocked if any approval is currently active on that workflow; allowed (with a warning) if only historical records reference it.
- A warning banner appears if a workflow has active in-flight approvals, cautioning that step changes may affect them.
- **Note:** a drag-to-reorder handle is visible next to each step in the editor, but it is not functionally wired up — reordering must currently be done by editing each step's order number individually.

### 12.4 Module Visibility
- Controls which menu items appear in a role's (or a specific position's) sidebar.
- Can **borrow** a menu item from one role into another role or position as a special case, and remove it again later.
- **Important distinction:** this only controls what's *visible in the menu* — it does not, by itself, block someone from opening a page directly if they know its address. Actual access control is enforced separately and cannot be bypassed by adjusting this screen.

### 12.5 System Settings
- **VAT Rate**: a single system-wide percentage used in every Subtotal/VAT/Total calculation. Changing it only affects new quotations/PR2s/POs going forward — figures already generated keep the rate that was in effect when they were created.
- **Email (SMTP) Settings**: Host, Port, Secure toggle, Username, Password, From address, From name — governs outgoing bug-report and RFQ-invitation emails specifically (account invite and password-reset emails are handled separately by the underlying auth system, not by this setting). A **Send Test Email** option confirms the configuration works before relying on it; the save itself performs a live connection check and rejects a broken configuration outright.
- **Dropdown Options**: the shared lists used throughout the system (e.g., Warehouse locations, Payment Terms, Request Purposes, Units of Measure, and document-type lists) — add, edit, reorder, or delete entries per category. Duplicate values are blocked automatically. The built-in **"Other"** fallback option is permanently protected and cannot be edited, reordered, or deleted.

### 12.6 Audit Logs
- A complete, searchable record of significant actions system-wide — who did what, to which document, from what IP address, and when — filterable by action, document type, and date range.
- Opening a log entry shows full detail, including a before/after comparison for what changed.
- User management, position/department changes, and workflow-step changes are all automatically logged. **Note:** Module Visibility changes are the one configuration area that does **not** currently produce an audit log entry.

---

## 13. Features Available to Everyone

### 13.1 Notifications
- A bell icon shows unread notifications in real time (instant push, not just periodic refresh); clicking one jumps straight to the relevant record and marks it read.
- Triggered automatically by dozens of events across the system — an approval needed, a rejection, a supplier quote or substitute offer, a PO being sent, a delivery status change, an accreditation or product decision, and more.
- Notifications are always in-app; an accompanying email is sent only for specific flows that are deliberately wired to also send one (e.g., new/resolved bug reports, RFQ invitations) — not automatically for every notification type.

### 13.2 Messaging
- Direct, one-to-one messaging between users, with search-to-start-a-conversation, threaded replies, unread badges, and message editing/soft-deletion (a deleted message shows as "Message deleted," not fully erased).
- File attachments: images, PDF, and Office documents (Word/Excel/PowerPoint), max 10 MB each, **up to 3 attachments per message.**
- **Deliberate restriction:** an Employee (requestor) and a Supplier cannot message each other directly, in either direction — the system requires that communication to be routed through Procurement instead. This is enforced at the database level, not just hidden in the UI. Admin is exempt and can message anyone.

### 13.3 Bug/Issue Reporting ("Bug Track")
- Any signed-in user can report a problem: a summary, where it happened, severity (Low/Medium/High), a description, what was expected instead, and an optional error message/screenshot.
- Submitting notifies Admin automatically (in-app, plus an internal email if one is configured for the team).
- Status path: **Open → In Progress → Resolved / Closed**, each transition notifying the original reporter in-app; a "Resolved" status additionally triggers an email to the reporter.
- Admin has an extra "AI-Ready Prompt" tool that reformats a bug report for pasting into a coding assistant.

### 13.4 Profile
- Every user can update their own display name and change their password (current password required first, as a security check).
- Role, department, and position are shown but not self-editable — that requires an Admin.
- Suppliers additionally see a "Commercial Terms" section to set their own default payment terms.

### 13.5 Printing
- A **Print** button is available on PR1, PR2 (both the Employee/Warehouse path and the Planning-direct path), Purchase Orders, and Goods Receipt Notes, producing a clean, formatted, signature-ready version. **Note:** RFQs do not currently have a dedicated print view.

### 13.6 Search & Filtering
- Every major list screen shares the same filtering pattern: free-text search, plus contextual filters (status, department, priority, date range, etc.) with a visible result count and a one-click "clear filters."

### 13.7 Priority Levels
- **Priority (Normal / Medium / High) exists on PR1s** and flows through everywhere downstream that references it — it's a triage aid for Warehouse, Approvers, and Procurement, and does not change who approves a request or skip any step.
- It can be changed after submission by Procurement or any Approver (on any PR1), or by the original requestor themselves (their own PR1 only); changing it notifies the assigned buyer.

### 13.8 VAT Handling
- One system-wide VAT rate (set by Admin) applies wherever VAT math is needed.
- Per line item, pricing is one of: not VAT-applicable, **VAT-Exclusive** (tax added on top of the quoted price), or **VAT-Inclusive** (the quoted price already contains tax, and the system backs out the pre-tax subtotal for display). Whether a supplier is VAT-registered at all is set on their account by Admin, and determines whether they're even asked to choose between inclusive/exclusive when quoting.

### 13.9 External Vendor Support
- Procurement can transact with a supplier that has no account in the system at all — a marketplace purchase, a walk-in store, a one-off source — by adding them to an RFQ by name only, then entering their quote manually. They flow through the rest of the process (PO, "Mark as Ordered" instead of "Send to Supplier") without ever needing a login, and are excluded from every notification/email path since there is no account to reach.

### 13.10 Account Access & Security
- **Login** via email and password; a deactivated account is blocked immediately with a clear message, even if the credentials are correct.
- **Forgot Password** always shows the same neutral confirmation message regardless of whether the email actually matches an account, so no one can use it to guess which emails are registered.
- **Invitations** (from Admin, or from Procurement specifically for supplier accounts) send an email link that lets the invited person set their own password rather than being handed one.
- A **"Remember this device"** option controls how long a session is kept before requiring another login.

---

# Part B — Context of the System

## What This Is

**Fortune Procurement System** is the company's internal system of record for the entire purchasing lifecycle — from the moment anyone in the company needs something, through supplier selection, formal ordering, delivery, and final receipt. It replaces the manual, paper-and-email version of this process with one continuously tracked, auditable digital trail: every request, every approval, every quote, every peso committed, and every item received is a permanent record, timestamped and attributed to the person who acted on it.

## The Problem It Solves

Before a system like this, a purchase request typically moves through several departments by phone calls, printed forms, and email chains — with no single place to see where it currently stands, no guaranteed record of who approved what and why, and real risk of things being lost, duplicated, or acted on out of order. This system replaces that with:
- **One authoritative status** for every request, visible to everyone who has a legitimate reason to see it.
- **Automatic hand-offs** — the right person is notified the moment it's their turn to act, with no one needing to chase anyone down.
- **Enforced separation of duties** — no single person can request, approve, and pay for the same purchase; every value-bearing step requires a second person's sign-off.
- **A permanent, searchable history** of who did what and when, for audits, disputes, or simply understanding why a decision was made months later.

## The Three Kinds of Requests It Handles

The system explicitly distinguishes between three procurement categories, because each has different rules for who can request it, how it's checked, and how it's received:

| Type | Who can request it | Entry point | Distinguishing rule |
|---|---|---|---|
| **Goods** | Any Employee | PR1, then a Warehouse stock check | Warehouse receives and inspects the physical delivery |
| **Raw Materials** | Planning only | PR2 directly (no PR1, no stock check) | Every single unit is mandatorily quality-tested by TSQA before it can be received |
| **Services** | Employee **or** Planning | PR1 (Employee) or PR2 directly (Planning) | Procurement, not Warehouse, confirms the service was completed; some services additionally require supporting compliance paperwork before receipt can be finalized |

## The People Who Use It

The system recognizes seven distinct **roles**, each with its own dashboard, its own menu, and — critically — its own restricted view of the data (a Warehouse user, for instance, never sees pricing anywhere in the system; a Supplier only ever sees their own company's records):

- **Employee** — raises requests for what they need. (The **Planning Staff** position within this role has the extra ability to request Raw Materials/Services directly.)
- **Warehouse** — checks existing stock, and physically receives and inspects deliveries.
- **Procurement** — sources suppliers, runs canvassing, issues and sends Purchase Orders, and manages the supplier roster. (Positions within this role — Procurement Staff, Buyer, Procurement Manager — also sit as reviewers at specific approval checkpoints.)
- **Approver** — reviews and decides at assigned checkpoints only (Supervisor, Department Head, Director, Operations Manager, Finance Director — each a different checkpoint in the chain).
- **Supplier** — an external company, with its own separate portal, that sells goods or services to the company.
- **TSQA** — the quality gate for raw materials and any goods flagged for inspection.
- **Admin** — manages the people, structure, and configuration of the system itself.

A person can hold more than one role's worth of responsibility only if explicitly assigned that way by Admin (e.g., a position can be both a requestor and, separately, an approver at a different checkpoint) — the system does not grant cross-role access implicitly.

## How the Pieces Connect

Every purchase — regardless of which of the three types it is, or who originated it — converges onto the same downstream sequence once it clears internal certification: **sourcing suppliers (RFQ) → formal Purchase Order → supplier delivery → receiving and closing the loop (GRN)**, with quality inspection, substitute-item review, and compliance documentation layered in exactly where each request type needs them, and nowhere else. This convergence is deliberate — it means Procurement, Approvers, and everyone downstream deal with one consistent process regardless of where a given request started.

---

*This document reflects the system exactly as implemented at the time of writing, verified directly against the working code rather than assumed from prior documentation. Configuration (approval steps, dropdown values, module visibility) can change over time via the Admin screens described in §12 — if the live system differs from something stated here, that reflects a configuration change since this document was written, not an error in it.*
