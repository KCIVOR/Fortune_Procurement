# Fortune Procurement System — Complete User Manual

**A plain-language guide to every feature, organized by role.**

---

## Contents

| Section | Role |
|---|---|
| [1. Role: Employee](#role-employee) | Staff, Planning Staff |
| [2. Role: Warehouse](#role-warehouse) | Warehouse Staff, Warehouse Manager |
| [3. Role: Procurement](#role-procurement) | Procurement Staff, Buyer, Procurement Manager, Authorized Personnel |
| [4. Role: Approver](#role-approver) | Supervisor, Department Head, Director, Operations Manager, Finance Director |
| [5. Role: Supplier](#role-supplier) | Supplier Representative |
| [6. Role: TSQA](#role-tsqa) | TSQA Staff |
| [7. Role: Admin](#role-admin) | System Administrator |
| [8. Features Everyone Has](#features-everyone-has) | All roles |
| [9. How a Request Travels Through the System](#how-a-request-travels-through-the-system) | All roles |

---

## How to Read This Manual

This manual is organized **by role** — find the role that matches your job, and read that
section. You do not need to read the whole manual; only the section(s) that apply to you.

A few people hold more than one role (for example, someone might be both an Employee and an
Approver). If that's you, read every section that applies.

Each role section covers:
- What you'll see when you log in
- Every screen/feature available to you, explained step by step
- What you are **not** able to do (so you know when to ask someone else)

At the end of the manual there are two extra chapters that apply to **everyone**:
- **Features Everyone Has** — notifications, messaging, printing, your profile, and reporting bugs
- **How a Request Travels Through the System** — a plain-language walk-through of the whole
  journey, from a request being raised to the goods arriving at the warehouse

---

## The Big Picture, in One Paragraph

This system manages company purchasing from start to finish: an employee (or Planning, for raw
materials) asks for something → it gets checked and approved internally → Procurement shops
around for the best supplier → a Purchase Order is issued and approved → the supplier delivers →
the warehouse (or Procurement, for services) checks it in. Every step is tracked, timestamped, and
routed automatically to the right person, so nothing has to be chased down by phone or email.

---

## Understanding Roles and Positions

The system assigns everyone a **role** (your job category) and, for most roles, a **position**
(your specific rank within that role, which can unlock a few extra permissions). Think of "role"
as *which department you work in* and "position" as *your seniority within it*.

| Role | Typical positions | In short |
|---|---|---|
| **Employee** | Staff, Planning Staff | Raises requests for what they need |
| **Warehouse** | Warehouse Staff, Warehouse Manager | Checks stock, receives deliveries |
| **Procurement** | Procurement Staff, Buyer, Procurement Manager, Authorized Personnel | Sources suppliers, creates purchase orders |
| **Approver** | Supervisor, Department Head, Director, Operations Manager, Finance Director | Reviews and approves requests at various stages |
| **Supplier** | Supplier Representative | External company that sells goods/services to us |
| **TSQA** | TSQA Staff | Quality-checks raw materials and flagged goods |
| **Admin** | System Administrator | Manages users, roles, and system-wide settings |

You will only ever see the menu items and screens relevant to your own role — the system hides
everything else automatically, so you can't accidentally wander into a screen that isn't yours.

---

# Role: Employee

*(Includes the "Planning Staff" position, which has one extra feature described in section 1.5
below.)*

As an Employee, you are the person who notices something is needed — office supplies, spare
parts, a repair service — and raises the request. You are the **Requestor**.

## 1.1 Your Dashboard

When you log in, you land on your personal dashboard, showing only *your own* requests:

| Tile / Section | What it shows |
|---|---|
| Total | How many requests you've ever submitted |
| Pending | Requests still moving through approval |
| Approved | Requests that made it through |
| Rejected | Requests that were turned down |
| Recent Requests | Your 5 most recent requests, with a quick link to view each |
| Substitute banner | Appears only when a supplier has offered a substitute item that needs your decision (see 1.3) |

## 1.2 My Requests (creating and tracking a Purchase Request)

This is where you ask the company to buy or arrange something for you. In the system this is
called a **PR1** (Purchase Request, step 1 of the process).

**Viewing your requests**
- Open **PR2 Requests** — actually your personal request list — to see every request you've ever
  submitted, with its current status.
- Use the search box to find a request by number or purpose, or filter by status or the date it
  was created.

**Creating a new request**
1. Click **New PR1** (or the equivalent "New Request" button).
2. Your name, department, and today's date are filled in automatically — you don't need to type them.
3. Choose a **Purpose** from the dropdown list (e.g., "Office Supplies", "Repair"). If your reason
   isn't listed, choose **Other** and type it in.
4. Pick the **Date Required** — when you need the item(s) by.
5. Choose a **Priority**: Normal, Medium, or High. This is required. It doesn't change who
   approves your request or skip any steps — it simply helps Warehouse, Approvers, and Procurement
   triage and sort their queues, so an urgent request is easier for them to spot.
6. Add one line per item you need: a description, the unit of measure (pieces, boxes, kilograms,
   etc.), and the quantity you need.
   - If an item is a raw material used directly in production, tick the **Raw Mat.** box on that line.
   - You can attach a supporting file to any item (a photo, spec sheet, or quote) — click the
     attachment icon on the line.
   - Remove a line you added by mistake with the delete icon.
7. When you're done, you have two choices:
   - **Save Draft** — keeps the request on your list without sending it anywhere yet, so you can
     finish it later.
   - **Submit** — sends it into the approval process. Once submitted, Warehouse is notified to
     check stock for you.

**After you submit**
- You cannot edit or delete a request once it has been submitted — only drafts can be changed or
  deleted. If something needs correcting after submission, ask the current approver to send it
  back to you as a **Revision**.
- Open any request to see its full detail: the items, and a **timeline** showing who has already
  signed off and who is next.
- Click **Print** on any request to get a clean, printable version.
- The status badge on each request always reflects exactly where it is in the process (e.g.,
  *Pending Warehouse Validation*, *Approved*, *Rejected*, *Completed*).

## 1.3 Substitute Review

Sometimes a supplier can't provide the exact item you asked for and offers something similar
instead (a different brand, a close equivalent, etc.). When that happens, you get to decide
whether it's acceptable.

- Open **Substitute Review** to see everything currently waiting on your decision, plus how many
  you've already accepted or rejected.
- Search or filter the list by request number, purpose, or supplier.
- Open a substitute card to see a clear side-by-side comparison: **"You requested"** next to
  **"Supplier is offering."** Any files the supplier attached (photos, spec sheets) can be viewed
  here too.
- Note: the supplier's price is intentionally hidden from you at this stage — pricing decisions
  are handled by Procurement.
- Add a short note if you like, then click **Accept** or **Reject**.
  - If you Accept, that substitute becomes eligible to be used.
  - If you Reject, the system falls back to exactly what you originally asked for.
  - You can change your mind and pick again, as long as the quotation round is still open.
  - Note: either you *or* Procurement accepting is enough to move forward — you don't both have to agree.

## 1.4 Delivery Status (view only)

You can check on the delivery progress of anything you've requested, but you cannot make changes
here — this is a read-only tracking screen.

- Open **Delivery Tracking** to see shipments grouped by status: All, Pending, Scheduled, In
  Transit, Delayed, Delivered.
- Search by purchase order number, supplier, or warehouse.
- Open any delivery to see a timeline of status updates and key dates.
- Pricing is hidden here as well — you'll see "Price hidden" instead of dollar amounts.

## 1.5 Extra Feature for Planning Staff: Direct Raw Material / Service Requests

If your position is **Planning Staff**, you have one extra ability the standard Employee doesn't:
you can skip the PR1 step entirely and create a **Raw Material** or **Service** request directly,
because Planning's requests are based on production forecasting and don't need a stock check
first.

- Open the direct-entry request form, choose **Raw Materials** or **Services** as the type, fill
  in the requestor, sequence number, purpose, and items — same as a normal request — and submit.
- This request goes straight to Department Head and Operations Manager approval, skipping
  Warehouse entirely.

## 1.6 What You Cannot Do

- You cannot see or approve anyone else's requests.
- You cannot access Procurement, Purchase Order, RFQ (supplier canvassing), Warehouse, Admin, or
  Supplier screens — those menu items simply won't appear for you.
- You cannot edit or delete a request once it has left Draft status.

---

# Role: Warehouse

*(Includes both "Warehouse Staff" and "Warehouse Manager" positions — they see the same screens.)*

As Warehouse, you are the bridge between a request and Procurement. You check whether we already
have the item in stock, and later, you're the one who physically receives what suppliers deliver.

## 2.1 Dashboard

| Tile / Section | What it shows |
|---|---|
| Pending Validation | How many requests are waiting on you to check stock |
| Validated Today | Stock checks you've completed today |
| Open GRN | Goods receipts still in progress |
| GRN Completed | Goods receipts you've finished |
| Preview panels | Quick previews of your validation queue and goods receipts, each with a "View all" link |

## 2.2 Validation Queue (checking stock and creating PR2)

This is your main job: for every submitted Purchase Request (PR1), you check whether we already
have enough of the item on hand.

1. Open the **Validation Queue** to see every PR1 waiting on you. Search by request number,
   requestor, department, or purpose, and filter by priority.
2. Click **Validate** on a request to open the stock-check screen.
3. For each item on the request, you'll see how much was requested. Enter the **Verified Stock on
   Hand** (SOH) — how many units we actually have right now.
   - If your entered stock is enough to cover the request, the system automatically shows
     **Sufficient**.
   - If it isn't enough, it shows **Insufficient**.
   - You can add a note on any line — for example, explaining a partial-quantity adjustment. If
     you change the requested quantity, always leave a note explaining why.
4. You can **Save Progress** at any point to keep your work without finalizing it yet.
5. When ready, click **Submit Warehouse Validation**.
   - Items marked **Sufficient** are fulfilled internally — no purchasing is needed.
   - Items marked **Insufficient** are automatically routed to Procurement, and you create a PR2
     (Purchasing Request) for those items, which is your official handoff into the purchasing
     process. You are recorded as the "Prepared By" on that PR2.
   - A single request can have a mix of both outcomes — each line is handled on its own.
6. Every validation you complete is logged in your **Warehouse History** for later reference.

## 2.3 Goods Receipt (GRN) — receiving deliveries

When a supplier delivers something, you're the one who checks it in.

1. Open **Goods Receipt** and use the tabs (All / Open / Closed) to find what you're looking for.
   Search by GRN number, purchase order, supplier, department, or warehouse.
2. Open a GRN tied to a delivered Purchase Order. You'll see what was ordered versus what has
   actually been received or rejected so far.
3. Physically inspect what arrived against the supplier's Delivery Receipt (DR), item by item.
   Record:
   - The quantity actually **received**
   - Any **discrepancy** (short or over delivery), with a note explaining it
   - Any quantity you're **rejecting** (damaged, wrong spec, etc.), with a reason — rejected items
     are noted on the supplier's paperwork and are not considered received
4. If some items still haven't fully arrived, the GRN stays **Open** so you can keep adding to it
   as the rest comes in.
5. You may flag a specific item as needing quality testing, even if it isn't officially a raw
   material — this is your call to make case by case (e.g., a batch you want double-checked). Any
   flagged item is routed to TSQA and must be cleared by them before the GRN can close.
   - **Note:** if the item *is* a raw material, this QA flag is mandatory, not optional.
   - While any item is waiting on TSQA, the whole GRN sits in a **Pending QA** status — a third
     status alongside Open and Closed — until every flagged item has been cleared.
6. Once everything on the GRN has been resolved — including any TSQA sign-offs — click **Close
   GRN**. A closed GRN can be reopened later by you or Procurement if a correction is needed.
7. Click **Print** for a finalized, printable copy of the GRN.
8. Note: cost/price columns are hidden from you throughout this screen — that information isn't
   part of your job here.

## 2.4 Delivery Tracking (view)

You can view the same delivery-tracking list described for Employees (section 1.4), including
status history and dates, so you know what's inbound before it arrives.

## 2.5 Warehouse History

A running log of every stock validation you've completed — searchable and filterable by date or
type — useful for looking back at past decisions.

## 2.6 What You Cannot Do

- You cannot access RFQ/Canvassing, Purchase Orders, Supplier management, or Admin screens.
- You cannot see pricing information anywhere in your view of the system.

---

# Role: Procurement

*(Includes "Procurement Staff", "Buyer", "Procurement Manager", and "Authorized Personnel"
positions. Procurement Manager acts as a reviewer at several approval checkpoints described
below.)*

Procurement is the hub of the purchasing process — you source suppliers, negotiate through
quotations, issue Purchase Orders, and manage the supplier relationship end to end.

## 3.1 Dashboard

Every tile is clickable and takes you straight to the relevant list.

| Tile | What it shows |
|---|---|
| Accreditation Queue | Suppliers waiting on your review |
| Pending TSQA | Currently always shows 0 — left over from a retired product-testing step; not something to act on |
| Awaiting RFQ | Requests ready for you to start canvassing suppliers |
| Open RFQs | Canvassing rounds currently active |
| High Priority | Items needing urgent attention |
| Purchase Orders | POs currently in progress |

## 3.2 PR2 (Purchasing Request — the internal certification step)

**Important on ordering:** the PR2 comes first, and it must be fully approved internally *before*
you're able to open an RFQ against it — you cannot generate a PR2 from an RFQ, it's the other way
around.

- For ordinary Goods and Services requests, the PR2 is created for you automatically by Warehouse
  once they've validated stock (see section 2.2) — it lists the quantities needed, with no
  supplier or pricing attached yet.
- For Raw Materials and some Services requests, Planning creates the PR2 directly.
- Either way, the PR2 goes through its own internal approval (Department Head certifies it, then
  Operations Manager gives final approval — see section 4.3 for the Approver's side of this).
- Once approved, you'll see it appear on your **PR2** list, and it becomes eligible for sourcing.
- You can view, filter (by status or date), and print any PR2 at any time.
- If any item involves VAT, the PR2 detail page shows a **Subtotal / VAT / Total** breakdown at
  the bottom, not just one combined number.

## 3.3 Canvassing / RFQ (sourcing suppliers, after PR2 approval)

RFQ stands for **Request for Quotation** — this is where you shop around for the best price and
terms, once an approved PR2 exists. The RFQ is really a continuation of the same PR2 — not a
separate, unrelated request.

1. Open **Canvassing / RFQ** to see approved PR2s that are ready for sourcing.
2. Select one and click **Create RFQ**. A new RFQ batch is created with its own reference number.
3. Invite suppliers to quote:
   - Choose from your registered, accredited suppliers, **or**
   - Add an **external vendor** — a one-off source with no account in the system (for example, a
     marketplace like Shopee) — by simply typing their name. No login is created for them.
4. The items and specifications carry over automatically from the PR2.
5. Set a **closing date** (deadline) for suppliers to respond by, then **Send** the RFQ. All
   invited suppliers are notified.
6. As quotations come in, they appear together in a comparison table so you can see every
   supplier's price, lead time, and any attached files side by side, line by line.
   - If you added an external vendor, you enter their quote on their behalf, since they can't log
     in themselves.
   - If a supplier proposes a substitute/alternative item instead of exactly what was asked for,
     it's flagged and routed to the requestor (or you) for a decision — see the Substitute Review
     workflow.
7. For each item, **award** the winning quote — pick which supplier gets that line. Awarding one
   supplier's quote and then changing your mind about the underlying quote automatically clears
   the award so you don't accidentally keep a stale decision. Winning quotes are written back onto
   the PR2's items, so the PR2 now shows the awarded supplier, price, and totals.
8. Once you're satisfied, **Close** the RFQ.
9. Submit the canvassing results for their own sign-off: **Procurement Manager** reviews, then the
   **Director** gives final approval (you'll see this labeled "Canvassing sign-off" on the PR2
   record). Only once this is approved is the PR2 eligible to become a Purchase Order.

## 3.4 Purchase Orders

Once a PR2 is fully approved, you formalize it into an official Purchase Order (PO).

1. **Generate PO** from a PR2 whose canvassing sign-off is approved — supplier and line items are
   pre-filled for you.
   - Each supplier (including each external vendor) gets **their own separate PO** — POs are
     never merged across different suppliers.
2. You can enter a custom PO number if needed.
3. Choose **payment terms** from the dropdown (a sensible default is pre-filled based on the
   supplier, but you can change it).
4. Set the delivery address/instructions and add any remarks.
5. **Save as Draft** to keep working on it later, or **Submit for Approval** to send it into the
   PO approval process (three internal approval steps, followed by the supplier acknowledging it).
6. Track every PO's status as it moves: **Draft → For Approval → Sent to Supplier → Delivered.**
7. Search, filter, and print POs from the main list at any time.
8. Like the PR2, the PO detail page shows a **Subtotal / VAT / Total** breakdown whenever VAT
   applies.
9. If the PO is for an **external vendor** (one with no account in the system), you won't see the
   normal "send to supplier" step — instead you place the order directly with them yourself
   (by phone, email, or in person) and then click **Mark as Ordered** to reflect that on the PO.

## 3.5 Suppliers, Accreditation & Product Review

You manage the roster of companies we're allowed to buy from, and review what they're allowed to sell us.

**Supplier Accounts**
- Open **Supplier Accounts** to see every registered supplier. Search and open any supplier to see
  their full profile and history with us.
- **Add Supplier** creates one supplier login account at a time — enter their name, email, and
  payment terms.
- **Bulk Import** creates many supplier accounts at once from a spreadsheet: upload a `.csv` or
  Excel file (you can download a template first; up to 500 rows per file), match your file's
  columns to the system's fields (Email and Supplier Name are required, Payment Terms is
  optional), preview the first few rows to make sure the mapping looks right, then set one shared
  temporary password (at least 8 characters — you can also have the system generate one for you)
  that will be applied to every account you're importing. After you click Import, you get a
  results screen showing how many succeeded and how many failed, with the specific reason for
  each failure (for example, a duplicate email already in the system).
- On a supplier's profile, you (or Admin) can mark whether they are **VAT-able** or **Non-VAT** —
  this determines whether that supplier is asked to specify VAT-inclusive or VAT-exclusive pricing
  when they submit a quotation (see section 5.4).

**Accreditation**
- Open the **Accreditation** queue to see suppliers who have applied and are waiting on your
  review.
- Open an application to review the documents they've uploaded (business permits, tax
  clearance, etc.).
- **Approve** — the supplier becomes officially accredited and is notified.
- **Reject** with a written reason — the supplier is notified why, so they can correct and reapply.

**Product Review**

Note: for raw-material suppliers, *you* — not the supplier — maintain their product catalog.
Suppliers can view their own catalog and its status, but cannot add, edit, or submit products
themselves; that's done for them by Procurement.

- On the supplier's profile or via **Product Review → New Product**, pick the raw-material
  supplier you're entering a product for, then enter the product name, code, category,
  description, and specifications on their behalf.
- Open the **Product Review** list to see every product, with its status: Submitted, Under Review,
  Verified, or Rejected.
- You can **Verify** a product directly yourself, making it eligible to appear in RFQs — or
  **Reject** it with a reason.

## 3.6 Approvals You Participate In

You're not just an observer of the approval process — at certain steps, Procurement staff *are*
the reviewer. If your position is **Procurement Manager**, you review the canvassing results
before the RFQ goes to the Director for final sign-off, and you review the Purchase Order before
it goes to the Finance Director. Open your **Approval Queue** to see everything currently waiting
on you, and **Approval History** to see everything you've already acted on, complete with your
past remarks and timestamps.

## 3.7 Compliance Documents

For services that legally require supporting paperwork before we can consider them "received" —
for example, a Certificate of Calibration for equipment servicing — this screen tracks exactly
which Purchase Orders are still **Awaiting GRN**, **Pending Upload** (waiting on the supplier to
upload their document), or have **All Uploaded**. You should not finalize receiving a service if
its required compliance document is still missing.

## 3.8 Delivery & GRN (visibility)

You have full visibility into delivery tracking and goods receipts across the company (not just
your own requests), including totals and status logs, so you can step in if something needs
attention.

## 3.9 What You Cannot Do

- You cannot access Admin/system-configuration screens.
- You cannot self-approve your own PO past the internal steps that require other approvers
  (Procurement Manager, Finance Director) — the workflow enforces separation of duties.

---

# Role: Approver

*(Positions: Supervisor, Department Head, Director, Operations Manager, Finance Director — each
sits at a different checkpoint in the process, described below. Directors get one extra
capability described in 4.7.)*

As an Approver, your job is to review requests at your assigned checkpoint and decide: **Approve**,
**Reject**, or **Request Revision**. That's true at every single approval step in the system —
there are never more than these three choices.

| Your action | What happens |
|---|---|
| **Approve** | The request moves forward to the next approver or the next process step. |
| **Reject** | The request is closed. The original requestor is told why. |
| **Request Revision** | The request is sent back one step for correction, then re-enters approval once fixed. |

**Quick reference — the four approval chains you may take part in:**

| Document | Steps (in order) | Details |
|---|---|---|
| **PR1** (Purchase Request) | Supervisor → Department Head (final) | Section 4.2 |
| **PR2** (Purchasing Request) | Department Head → Operations Manager (final) | Section 4.3 |
| **RFQ** (Canvassing sign-off) | Procurement Manager → Director (final) | Section 4.4 |
| **PO** (Purchase Order) | Buyer → Procurement Manager → Finance Director (final), then Supplier acknowledges | Section 4.5 |

You'll only ever act on the step(s) that match your own position — the system won't show you steps
belonging to someone else.

## 4.1 Dashboard & Unified Queue

| Tile / Section | What it shows |
|---|---|
| Awaiting My Action | Everything sitting at your desk right now |
| Approved This Week | Items you approved in the last 7 days |
| Rejected This Week | Items you rejected in the last 7 days |
| Total Processed | Your all-time approval activity |
| Pending Approvals | Documents specifically at *your* step — you'll never see something waiting on someone else |

Open **Approval Queue** for a single combined view covering PR1, PR2, RFQ (Canvassing), and PO.

**Note on department scope:** if your position is **Supervisor**, **Department Head**, or
**Operations Manager**, your queues and dashboard only ever show requests raised within **your own
department**. If your position is **Director** or **Finance Director**, this restriction doesn't
apply to you — you see requests company-wide, from every department.

## 4.2 PR1 Approval (2 steps: Supervisor, then Department Head)

- Open the queue, filter by priority, department, or date if needed.
- Open a request to see who requested it, why, the items (with stock already checked by
  Warehouse), and a timeline of who has signed off so far and who's next.
- **Approve** to send it forward. If you're the Department Head, approving completes this stage
  and hands it to Warehouse to create the PR2.
- **Reject** always requires a written reason — the requestor is notified immediately.
- **Request Revision** sends it back to the requestor to fix.
- You can only ever act on a request that is sitting at *your* step — you cannot jump ahead or act
  out of turn.

## 4.3 PR2 Approval (2 steps: Department Head, then Operations Manager)

This is the internal certification of a request before Procurement is allowed to start sourcing
suppliers — it happens *before* any RFQ exists, not after.

- Open a PR2 to see the requesting department, purpose, and the items with their quantities (no
  supplier or pricing yet at this stage — that comes later, at RFQ approval).
- Step 1: **Department Head** certifies it ("Certified By").
- Step 2: **Operations Manager** gives final approval ("Approved By"). Approving this step
  automatically notifies Procurement that the request is ready for supplier canvassing.
- Reject at any step, with a reason, at any time.
- Some approval steps are configured to apply only within a certain value range (for example, a
  step that only kicks in for purchases above a certain amount) — if a step doesn't apply to your
  request's value, it's simply skipped.
- If you open a past PR2 that was rejected and sent back to Warehouse for revision, you'll see an
  amber notice that it's **archived** — you can still view its full items and history, but no
  action can be taken on it, since a fresh PR2 has since replaced it in the active workflow.

## 4.4 RFQ / Canvassing Approval (2 steps: Procurement Manager, then Director)

Once Procurement has canvassed suppliers and awarded winning quotes against an approved PR2 (see
section 3.3), the results come to you for sign-off — you'll see this labeled as the **"Canvassing
sign-off"** on the PR2 record, since it's a continuation of the same request, not a separate one.

- Open the PR2 to see the awarded items, their costs and totals, and — if you want to
  double-check — you can toggle to see the other competing quotes that weren't chosen.
- If your position is **Procurement Manager**, you review the canvassing results first.
- If your position is **Director**, you give the final approval. Approving notifies Procurement
  that the Purchase Order can now be created.
- Reject at any step, with a reason. If any item involves VAT, you'll see a **Subtotal / VAT /
  Total** breakdown, not just one combined figure.

## 4.5 PO Approval (3 internal steps, then the supplier acknowledges)

- Open the queue to see every PO currently routing through approval.
- Open a PO to review payment terms, delivery address, the full item list, and the grand total
  (shown as a Subtotal / VAT / Total breakdown when VAT applies).
- Internal approval order: **Buyer → Procurement Manager → Finance Director.**
- The **Finance Director's** approval is the final internal step — once given, the PO is marked
  Approved/Sent and routed onward to the supplier for their own acknowledgment (which they do in
  their own portal, not something you'll see in your queue).
- Reject at any step, with a reason — a rejected PO is never sent to the supplier.

## 4.6 Approval History

Open **Approval History** to see every action you've ever taken, with your remarks and
timestamps, searchable and filterable by date range. Opening a completed document gives you a
read-only view of the final record.

- Use the tabs to filter by document type: **All, PR1, PR2, PO, RFQ.**
- Each tab (other than **All**) shows only documents of that specific type that *you* personally
  approved, rejected, or sent back for revision — not everyone's activity, just yours.
- Seeing **"0 actions found"** on a tab is normal and expected if you've simply never acted on that
  document type. For example, if your work is mostly reviewing RFQs, your PR1 and PR2 tabs may
  reasonably show nothing — that doesn't mean records are missing. Check the **All** tab to see
  your complete signing history across every document type at once.
- **Note:** on rare older records, you may see a document number shown as "—" instead of a real
  number. This happens only when the original request behind that approval was later deleted from
  the system while the approval record itself was kept for history. It's cosmetic and doesn't
  affect anything — the approval itself is still valid and on record.

## 4.7 Extra Feature for Directors: Logistics Visibility

If your position is **Director**, you additionally get read access to Goods Receipt, Canvassing/RFQ,
PR2, Purchase Orders, and Delivery Tracking — so you can see the operational side of things you've
approved, beyond just the approval queue itself. Other approver positions (Supervisor, Department
Head, Operations Manager, Finance Director) do not have this extra access.

## 4.8 What You Cannot Do

- You cannot create or edit requests, RFQs, or Purchase Orders yourself — your role is to review
  and decide, not to originate documents.
- Non-Director approvers cannot open Purchase Orders or RFQ/Canvassing screens outside the
  approval queue.

---

# Role: Supplier

You're an external company that sells goods or services to us. You have your own portal, separate
from internal staff, and you only ever see your own company's records.

Procurement sets a **supply type** on your account, which determines a couple of extra screens you
do or don't see:
- **Raw Material** suppliers get a **Product Catalog** (section 5.3).
- **Service** suppliers get a **Compliance Documents** page (section 5.7).
- Suppliers of ordinary goods (**Normal** — e.g., office supplies) get neither extra screen; you
  just use Accreditation, Quotations, Purchase Orders, and Deliveries.

## 5.1 Dashboard

Every tile is clickable.

| Tile / Section | What it shows |
|---|---|
| Accreditation Status | Where your application currently stands |
| Total Products | All products you have listed |
| Verified | Products cleared for use in quotations |
| Pending Review | Products awaiting a decision |
| Open RFQs | RFQs you've been invited to |
| Pending Response | RFQs you haven't responded to yet |
| RFQ inbox | RFQs assigned to you, each with its due date |

## 5.2 Accreditation (getting approved to sell to us)

Before you can do business with us, you need to be accredited.

1. Submit your **accreditation application**.
2. Upload the required documents — business permit (DTI), Mayor's Permit, Tax Clearance, SEC
   registration, and any others requested — choosing the correct document type from the dropdown
   for each one.
3. Track your status: **Submitted → Under Procurement Review → Accredited.** You may also see
   **Action Required: Missing Documents** if something you uploaded needs fixing, or **Rejected**,
   **Withdrawn**, or **Expired**. You'll be notified the moment your status changes.

## 5.3 Product Catalog (Raw Material supply type only, view-only)

If your supply type is Raw Material, you have a product catalog — but it's maintained *for* you by
Procurement, not by you directly. You cannot add, edit, or submit products yourself.
- **View catalog** — see everything listed under your account, with code, category, price, stock,
  and status: Submitted, Under Review, Verified, or Rejected.
- Open any product to see its full verification history.
- **Important:** only products marked **Verified** can actually be selected when you submit a
  quote — an unverified product won't be usable in an RFQ response yet. If you need a new product
  added or an existing one corrected, contact Procurement.

## 5.4 Quotations (responding to RFQs)

This is how you bid on a request.

1. Open **Quotations** to see every RFQ you've been invited to, its closing date, and its status.
2. Open one to see exactly what's being requested, along with our billing/shipping details.
3. For each line item, either link it to a product from your catalog, or, if you can't supply the
   exact item, **propose an alternative** and explain your reasoning in the remarks — this gets
   routed to the requestor for a decision.
4. Enter your **unit price** and **lead time** (how many days you'd need to deliver).
5. If your company is registered as **VAT-able** (set on your account by Procurement), you'll also
   choose whether your price is **VAT-Inclusive** or **VAT-Exclusive** for that line — this tells
   us how to calculate the tax breakdown correctly. If you're marked Non-VAT, this choice won't
   appear.
6. You can attach supporting files — a spec sheet or brochure — to your quote.
7. Click **Submit Quotation**. You can still edit it up until the RFQ closes — note that changing
   a quote that was already awarded will clear that award, so the buyer will need to re-confirm it.
8. Once the RFQ closes, you can no longer submit or edit a quote for it.

## 5.5 Purchase Orders (acknowledging what you've won)

1. Open **Purchase Orders** to see every PO issued to you, with its status (Pending
   Acknowledgment, Acknowledged, Delivered).
2. Open one to review the items, billing address, and commercial terms.
3. Click **Acknowledge**, and enter your **commitment date** — the date you're committing to
   deliver by. This is required; you can't acknowledge without it. Add any remarks if needed.
4. Acknowledging automatically creates a delivery record you'll update next.

## 5.6 Delivery Management

1. Open **Deliveries** to see your shipments in progress, each with its related PO, estimated
   arrival, and current status.
2. As fulfillment progresses, update the status: **Scheduled → In Transit → Delayed → Delivered.**
3. When you deliver, set the **actual delivery date** and upload your **Delivery Receipt (DR)**
   and **Invoice**.
4. Confirm your update — Warehouse and everyone else tracking this request sees the new status
   immediately.

## 5.7 Compliance Documents (Service supply type only)

If your supply type is Service and you provide something that requires supporting documentation —
for example, a Certificate of Calibration — upload it here on your dedicated documentation page.
We cannot finalize receiving your service until the required document is uploaded.

## 5.8 What You Cannot Do

- You cannot see any internal company screens (requests, approvals, admin, etc.) — your access is
  strictly limited to your own portal.
- You cannot submit or edit a quote after the RFQ has closed.
- You cannot add, edit, or remove entries in your own product catalog — Procurement maintains it
  on your behalf.

---

# Role: TSQA

*(Technical/Sample Quality Assurance)*

You are the quality gatekeeper for delivered goods that need inspection before they can be
accepted into stock — raw materials always, and any other item Warehouse or Procurement flags for
a spot-check.

## 6.1 Dashboard

Your dashboard links straight to the **GRN QA Queue** — the goods receipts currently waiting on
your sign-off.

## 6.2 GRN Quality Approval

When Warehouse (or, for services, Procurement) flags a delivered item as needing your sign-off —
whether because it's a raw material (mandatory) or a discretionary spot-check — it lands in your
queue for inspection. Once you're satisfied, mark it **Approved** directly on the GRN. Until you
do, that GRN cannot be closed by Warehouse, no matter how everything else on it looks.

## 6.3 What You Cannot Do

- You cannot access Procurement, Admin, or any purchasing screens beyond what's described above.
- You cannot close a flagged item without personally marking it Approved — there's no shortcut
  around leaving a record of your inspection.

---

# Role: Admin

You manage the people, structure, and configuration of the entire system. This is the most
powerful role — use it carefully, especially anything that affects live workflows already in use.

## 7.1 Dashboard

| Tile / Section | What it shows |
|---|---|
| Users | Total user accounts in the system |
| Roles | Total roles configured |
| Positions | Total positions configured |
| Departments | Total departments configured |
| Audit Logs | Total logged actions |
| Recent Activity | Your 5 most recent audit-log entries, with a link to the full log |

## 7.2 User Management

1. Open **Users** to see everyone in the system: name, email, role, department, position, and
   whether their account is active.
2. Search or filter by role or department.
3. **Create a user** directly (fill in name, email, role, department, position, and set a
   password), or **invite** someone by email — they'll get a link to set their own password and
   activate their account.
4. **Edit** an existing user's role, department, or position — their menu and access update
   immediately to match.
5. **Reset a password** for someone who's locked out.
6. **Deactivate** an account to immediately block that person from logging in (useful when someone
   leaves), and **reactivate** it later if needed.

## 7.3 Roles, Positions & Departments

- **Roles** — view the fixed list of system roles and how many users hold each one.
- **Positions** — view, create, and edit positions (e.g., "Procurement Manager") and which role
  they belong to.
  - If you try to deactivate a position that's actively used as a step in a live approval
    workflow, the system blocks you and warns you — you'll need to update that workflow step
    first.
- **Departments** — view, create, and edit departments (name and code).
  - Deactivating a department that still has active users shows you exactly how many people would
    be affected and asks you to confirm before proceeding.

## 7.4 Workflow Configuration

This is where the actual approval sequences (like "PR1 goes to Supervisor, then Department Head")
are defined.

1. Open **Workflows** to see every configured workflow, its number of steps, how many documents
   are currently mid-flight on it, and whether it's active.
2. Select one (e.g., PR1_APPROVAL) to see its full step editor and a visual diagram of the sequence.
3. **Add a step**, specifying its order, a label, and which role/position handles it. Steps must be
   numbered without gaps — the system won't let you save a broken sequence.
4. You can also add a **threshold step** — one that only applies when the request's value falls
   within a certain range (e.g., only for purchases above a set amount).
5. **Edit** an existing step as needed.
6. You cannot delete a step that has documents actively mid-flight on it — only steps with no
   active usage can be removed.

## 7.5 Module Visibility

This controls which menu items different roles/positions can see in their sidebar (separate from
what they're actually *allowed* to access, which is enforced elsewhere and cannot be bypassed by
this screen).

1. Toggle whether a role sees a given module by default.
2. Fine-tune visibility for a specific position within that role, rather than the whole role.
3. **Borrow** a module from another role into a different role/position's sidebar if a special
   case calls for it, and remove that borrowed item later if no longer needed.
4. Important: turning a module's visibility off only hides the menu link — it does **not** remove
   someone's actual permission to open that page if they know the direct link. Genuine access
   control is handled separately (see Workflow/Route rules), so use this purely for menu tidiness,
   not as a security control.

## 7.6 System Settings

Open **Settings** for three areas:

**VAT Rate**
- Set the VAT percentage (0–100%) used across the system's Subtotal/VAT/Total calculations on
  quotations, PR2s, and Purchase Orders.

**Email (SMTP) Settings**
- Configure the outgoing mail server used to send system notifications: Host, Port, Username,
  Password, "From" email address, and "From" name.
- **Send a test email** to a recipient of your choice, using the currently saved settings, to
  confirm everything is configured correctly (save your changes first if you just edited them).

**Dropdown Options**
- Manage the six categories of dropdown menus used throughout the system (for example: Warehouse
  locations, Payment Terms, Request Purposes, Units of Measure, and document type lists).
- **Add**, **edit**, **reorder**, or **delete** any option. Duplicate values are automatically
  blocked. Editing a label updates it everywhere it's used in the system.
- The built-in **"Other"** option is permanently locked — it can't be edited, reordered, or
  deleted, since it's a fallback built into the system itself.

## 7.7 Audit Logs

A complete, searchable record of significant actions taken across the system — who did what, on
which document, from what IP address, and when.

- Search by action, actor, or reference number, and filter by document type, action, or date range.
- Open any log entry to see full detail, including a technical before/after comparison for that
  change (useful when investigating exactly what was modified).
- Key actions are always logged automatically — account deactivations, approvals, awards, and more
  — so nothing significant happens without a trace.

---

# Features Everyone Has

Regardless of your role, these tools are available to you at all times.

## 8.1 Notifications

Click the bell icon to see your notifications — unread items are clearly marked. Click any
notification to jump straight to the record it's about, and it's automatically marked as read.

You'll be notified automatically whenever something relevant happens to you, for example:
- Your request was approved, rejected, or needs your attention
- A supplier submitted a quote or proposed a substitute
- A Purchase Order was sent, or a delivery status changed
- An accreditation or product decision was made

## 8.2 Messaging

Open **Messages** to send and receive direct messages with other users in the system.
- Search for a person and start a new conversation.
- Reply within an existing thread.
- Attach and send files — recipients can download them directly from the conversation.
- An unread badge shows you when you have something new to read.

## 8.3 Reporting a Bug or Problem

If something isn't working right, you don't need to email anyone — report it directly.

1. Click the **Bug Track** icon.
2. Fill in a summary, the page/URL where it happened, how severe it is, a description, and what
   you expected to happen instead.
3. Attach a screenshot if it helps explain the issue.
4. Submitting automatically emails the development team.
5. You'll be emailed again automatically once it's resolved.

## 8.4 Your Profile

Open **Profile** to:
- View your name (editable) and your role/department/position (fixed — contact your Admin if
  these need to change).
- Update your display name.
- Change your password — you'll need to enter your current password first as a security check.

## 8.5 Printing

Every major document — Purchase Requests (PR1), Purchasing Requests (PR2), Purchase Orders (PO),
and Goods Receipt Notes (GRN) — has a **Print** button that opens a clean, print-formatted version
suitable for physical filing or signatures.

---

# How a Request Travels Through the System

This chapter walks through the whole journey in plain language, so you can see how your part fits
into the bigger picture. There are four variations depending on what's being requested.

At **every** approval checkpoint mentioned below, the approver has exactly three choices: **Approve**
(move forward), **Reject** (close the request, requestor is told why), or **Request Revision**
(send it back one step for a fix).

## 9.1 Path A — Ordinary Goods (the default path)

| Step | Who | What happens |
|---|---|---|
| 1 | Employee | Creates a request (PR1) for something needed |
| 2 | Supervisor | Reviews it |
| 3 | Department Head | Approves it |
| 4 | Warehouse | Checks whether we already have it in stock. **If sufficient**, it's fulfilled internally and the journey ends here. **If not**, Warehouse creates the PR2 and the request moves to Procurement |
| 5 | Department Head → Operations Manager | Certifies, then gives final approval on the PR2 — Procurement is automatically notified it's ready for sourcing |
| 6 | Procurement Staff | Canvasses suppliers through an RFQ and records their quotes |
| 7 | Procurement Manager → Director | Reviews the canvassing results, then gives final approval — Procurement is notified the Purchase Order can now be created |
| 8 | Procurement Staff | Creates the Purchase Order (PO) |
| 9 | Procurement Manager → Finance Director | Reviews, then gives final approval on the PO |
| 10 | Procurement Staff | Manually sends the PO to the supplier — a deliberate action, never automatic |
| 11 | Supplier | Acknowledges the PO with a delivery commitment date, then updates delivery progress — visible in real time to Procurement, Warehouse, and the original requestor |
| 12 | Warehouse | Receives the goods, inspects against the delivery paperwork, creates the Goods Receipt Note (GRN); may flag any item for quality testing |
| 13 | TSQA | Inspects and approves any flagged item |
| 14 | Warehouse | Closes the GRN once everything is resolved and prints the finalized copy — journey complete. The requestor now sees their request as **Completed** |

## 9.2 Path B — Raw Materials

Raw materials (paper, ink, glue, varnish, and similar production materials) skip the early steps,
since Planning already knows exactly what's needed from production forecasting:

| Step | Who | What happens |
|---|---|---|
| 1 | Planning | Creates the PR2 directly — no PR1, no Warehouse stock check needed |
| 2 | Department Head → Operations Manager | Certifies, then gives final approval |
| 3 | *(everyone)* | From here, identical to Path A: RFQ → PO → supplier delivery → receiving |
| 4 | TSQA | **Every** raw material item must be quality-tested before the GRN can close — mandatory here, unlike the discretionary flag for ordinary goods |

## 9.3 Path C — Services

Services (like equipment servicing or calibration) can start two different ways:

| Step | Who | What happens |
|---|---|---|
| 1 | Employee **or** Planning | Either an Employee raises a PR1 (same entry as Path A), or Planning creates the PR2 directly (same entry as Path B) — both are valid |
| 2 | *(everyone)* | From there, matches Path A through RFQ, PO approval, and the supplier acknowledging/updating progress |
| 3 | Procurement | Receives the completed service and creates the GRN — **not** Warehouse. There is no TSQA step for services |
| 4 | Supplier → Procurement | If the service requires supporting paperwork (e.g. a Certificate of Calibration), the Supplier uploads it; Procurement cannot finalize receipt until it's in place |

## 9.4 Path D — Substitute Items (a side-path during sourcing)

This can happen during the RFQ stage of any of the three paths above, whenever a supplier can't
supply exactly what was asked for:

| Step | Who | What happens |
|---|---|---|
| 1 | Supplier | Offers a substitute (a different brand or close equivalent) while quoting |
| 2 | *(system)* | Both the original requestor and Procurement are notified |
| 3 | Requestor **or** Procurement | Either one (not both required) reviews the substitute side by side with the original request and Accepts or Rejects it |
| 4 | *(system)* | If accepted, the substitute becomes eligible to be awarded like any normal item, and the journey continues normally (RFQ approval → PO → delivery → receiving) |
| 5 | *(system)* | Once the RFQ closes, substitute decisions are locked in and can't be changed |

---

*This manual reflects the system as configured at the time of writing. If a screen or workflow
step looks different from what's described here, check with your Admin — settings like approval
steps and dropdown options can be adjusted over time.*
