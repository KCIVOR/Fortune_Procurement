# Manual test journey — Accreditation document expiry, needs-revision, logic hardening

Use this after logging into `http://localhost:3000` on branch `feat/accreditation-document-expiry`.
Covers Path B (document-level expiry), needs-revision, and the concurrency/integrity fixes from
[2026-07-15-accreditation-logic-hardening.md](plans/2026-07-15-accreditation-logic-hardening.md).

## Accounts (from live DB, checked 2026-07-15)

| Role | Login | Current state | Use for |
|------|-------|----------------|---------|
| Procurement | `procurement@fortune.com` (Ana Gomez) | — | All procurement-side steps |
| Supplier — Metro Office Supplies | `supplier2@fortune.com` | **Rejected**, 3 pending docs on file | Journeys A–D (full draft → submit → review → approve cycle) |
| Supplier — Ace Supply Corp | `supplier@fortune.com` | **Approved**, 2 pending (unverified) docs | Journeys E–F (post-approval doc actions, revoke/reopen) |

*(Use your known demo password for `@fortune.com` accounts.)*

Mark each step Pass / Fail. Steps marked **[FIX]** specifically exercise one of the
2026-07-15 hardening changes — don't skip those even if they look redundant with an earlier step.

---

## Journey A — Supplier: start new application, upload, submit

**Login:** Metro Office Supplies — `supplier2@fortune.com`

| # | Step | Expected |
|---|------|----------|
| A1 | Go to `/supplier/accreditation` | Status chip shows **Rejected**; description says "You may start a new application" |
| A2 | Confirm the upload form area | Says uploads aren't available for this closed application — no file picker shown |
| A3 | Click **Start New Application** | New application created, status flips to **Draft** |
| A4 | Upload 2–3 documents of different types (PDF/JPG/PNG, ≤20MB) | Each appears in the list with chip **Pending** |
| A4b | On one Pending document, click **Replace file** and upload a different file **[FIX — new]** | File swaps in place (same row) — no duplicate row created; still **Pending** |
| A5 | Try uploading a file >20MB or a `.docx` | Rejected client-side with a clear error, nothing uploaded |
| A6 | Click **Submit for Procurement Review** | Status → **Submitted**; success banner shown |

---

## Journey B — Procurement: review, missing docs, resubmit

**Login:** Procurement — `procurement@fortune.com`

| # | Step | Expected |
|---|------|----------|
| B1 | Open `/accreditation`, find Metro Office Supplies | Status **Submitted**; no "Valid Until" column in the table header **[FIX — column removed]** |
| B2 | Open the application detail | Header banner explains document verification is separate from approval |
| B3 | Click **Mark Under Review** | Status → **Under Review** |
| B4 | Click **Request Missing Docs**, enter a note, **Send Request** | Status → **Missing Documents Requested**; note appears in "Missing Documents Note" |
| B5 | Switch to Metro's supplier login | Status **Action Required: Missing Documents**, note visible, upload form available again |
| B6 | Upload one more document, then **Submit for Procurement Review** | Status → **Submitted** again |
| B7 | Back on procurement: **Mark Under Review** | Status → **Under Review** |

---

## Journey C — Procurement: verify / reject / needs-revision / replace

**Login:** Procurement, same Metro application detail page

| # | Step | Expected |
|---|------|----------|
| C1 | On a **Pending** document, pick **today's date** in the expiry field, click **Verify** | Error: expiry must be a future date. Document stays Pending |
| C2 | Pick a date next week, click **Verify** | Chip → **Verified**, "Expires <date>" shown next to file |
| C3 | Click **Re-verify** on that same doc with a different future date | Expiry updates, still **Verified** |
| C4 | On a second **Pending** document, click **Reject** | Opens a remark panel — **Confirm rejection** is disabled until you type a reason |
| C4b | Type a reason, click **Confirm rejection** | Chip → **Rejected**; reason shown under the row as "Rejection reason: ..." |
| C4c | Supplier login: open the same document | Shows chip **Rejected** + "Reason: <same text>" + a **Resubmit file** control (same mechanics as Needs revision's Replace file — Reject is a "harder needs-revision," not a dead end) |
| C4d | Click **Resubmit file**, upload a new file | Chip → **Pending**, reason cleared, file updated — same as the needs-revision replace flow |
| C4e | Procurement: re-verify the resubmitted document | Chip → **Verified**, same as any other pending document |
| C5 | On a third document (or the same Verified one from C2), click **Needs revision**, type a remark, **Send revision request** | Chip → **Needs revision**; remark visible under the row |
| C6 | Confirm the application status | Still **Under Review** — a document going to Needs revision must **not** move the application to Missing Documents |
| C7 | Switch to Metro's supplier login, open Accreditation Documents | The needs-revision doc shows chip **Needs revision** + "What to fix: <remark>" + a **Replace file** control |
| C8 | Click **Replace file**, upload a new file | Chip → **Pending**, remark cleared, file name updated |
| C9 | Back on procurement, re-open the app, verify the replaced document with a future date | Chip → **Verified** |

---

## Journey D — Procurement: approve (independent of document state)

**Login:** Procurement, Metro application detail

| # | Step | Expected |
|---|------|----------|
| D1 | Confirm at least one document is still **Rejected** (from C4) and the rest are a mix of Pending/Verified | — |
| D2 | Click **Approve**, add an optional note, **Confirm Approval** | Succeeds even though not all documents are Verified — approval never blocks on document state |
| D3 | Confirm the approve panel copy | Says "Document expiry is set per file... not on this approval" — no Valid Until input anywhere |
| D4 | Application status | **Approved** |
| D5 | Supplier login: status | **Accredited** |

---

## Journey E — Post-approval document management (already-approved application)

**Login:** Procurement, open Ace Supply Corp (`supplier@fortune.com`) — already **Approved** with 2 pending docs

| # | Step | Expected |
|---|------|----------|
| E1 | Open Ace's application detail | Status **Approved**; document actions (Verify/Reject/Needs revision) are still available even though the application is closed for review actions |
| E2 | Verify one of the 2 pending docs with a future date | Chip → **Verified**; application status unchanged (**Approved**) |
| E3 | Reject the other pending doc, enter a reason, **Confirm rejection** | Chip → **Rejected**; reason shown; application status still **Approved** |
| E4 | Confirm no "Approve"/"Reject"/"Request Missing Docs" buttons show | Only **Reopen for Review** and **Revoke Accreditation** are available (post-approval actions) |

---

## Journey F — Revoke → expired → reopen → re-approve

**Login:** Procurement, Ace Supply Corp detail (still Approved from Journey E)

| # | Step | Expected |
|---|------|----------|
| F1 | Click **Revoke Accreditation** without a reason, **Confirm Revocation** | Blocked: "A reason is required" |
| F2 | Enter a reason, confirm | Status → **Expired**; banner explains manual revoke |
| F3 | Check `/accreditation` queue | Ace shows **Expired** label with the danger-red badge **[FIX — expired now labeled correctly everywhere]** |
| F4 | Check the raw-material supplier picker (wherever suppliers are chosen for a PR/RFQ) | Ace shows **Expired**, styled like Rejected/Withdrawn |
| F5 | Supplier login as Ace | Status **Expired**; "You may start a new application" shown; document upload form hidden |
| F6 | Back on procurement: **Reopen for Review**, optional note, **Confirm Reopen** | Status → **Under Review**; existing documents (including the ones verified/rejected in Journey E) are untouched |
| F7 | **Approve** again | Status → **Approved** |

---

## Journey G — Withdraw (alternate path, optional)

Do this on a *fresh* draft/submitted application (e.g. repeat Journey A steps A3–A6 on any
closed test account, or catch Metro mid-flow before Journey D if you want to branch instead
of finishing the approval).

| # | Step | Expected |
|---|------|----------|
| G1 | While status is Draft, Submitted, or Missing Documents, click **Withdraw Application**, confirm in the dialog | Status → **Withdrawn** |
| G2 | Try to upload a document | Upload form hidden — closed application |
| G3 | Status description | "You may start a new accreditation application" |
| G4 | Click **Start New Application** | New Draft created — same code path as Journey A |

---

## Journey H — Concurrency / integrity fixes **[FIX]**

These exercise the 2026-07-15 hardening changes directly. They're about *not silently failing*, not about new features — pay attention to error messages, not just end states.

| # | Step | Expected |
|---|------|----------|
| H1 | On any document, click **Verify** and very quickly click it again (or double-click fast) before the row finishes reloading | Either both calls succeed cleanly (second one just re-verifies), or the second shows "This document was already changed by someone else. Please refresh and try again." — **never** a silent no-op with no message |
| H2 | On a **Needs revision** document, click **Replace file**, pick a file, and immediately try to trigger the file picker again before the upload finishes (or open the same app in a second tab and replace the same doc from both) | Only one replacement should "win"; the doc should end up pointing at *a* valid, viewable file — never a broken/404 file link. Click **View** on it afterward to confirm |
| H3 | Open the same application in two browser tabs as procurement. In tab 1, click **Approve**. Without refreshing tab 2, click **Reject** in tab 2 | Tab 2 should show an error ("already updated...") instead of silently flipping an approved application back to rejected |
| H4 | Try navigating directly to a closed application's supplier page and confirm no way to trigger an upload via the UI (no hidden/disabled-but-clickable controls) | Upload section fully replaced with the "not available" message |

---

## Journey I — RFQ / canvassing unaffected by document status

| # | Step | Expected |
|---|------|----------|
| I1 | Confirm Metro (approved in Journey D, has a Rejected document) still appears as an eligible/accredited supplier wherever RFQ/canvassing lists suppliers | Yes — RFQ eligibility only checks application status (`approved`), never individual document status |
| I2 | Confirm Ace (approved, revoked-then-reopened-then-reapproved in Journey F) behaves the same way | Yes |

---

## Journey J — Near-expiry notifications: 4 milestones **[FIX — new]**

Cron-driven, can't be triggered from the UI. Validate via the notification bell instead of a click-through. Fires independently at **2 months**, **1 month**, **15 days**, and **the day of expiration** — each is its own checkpoint, so a document can (and should) fire more than once as it gets closer.

| # | Step | Expected |
|---|------|----------|
| J1 | Log in as a supplier whose accreditation has at least one **Verified** document with `expires_at` within the next 2 months (e.g. re-verify one with a near date during Journey C/E) | — |
| J2 | Check the notification bell | A notification titled **"Accreditation Document Expiring in 2 Months"** (or **1 Month** / **15 Days**, whichever thresholds the date has already crossed) naming the file and expiry date, linking to `/supplier/accreditation` |
| J3 | Log in as procurement (any active account, e.g. `procurement@fortune.com`) | Matching notification(s) titled **"Supplier Document Expiring in X"**, naming the supplier, file, and expiry date, linking to that application's detail page |
| J4 | Confirm every other active procurement user also received them | Yes — fans out to all active procurement accounts |
| J5 | If the document's expiry date is close enough to trigger multiple thresholds at once (e.g. only 10 days left when first verified) | You should see **all applicable milestones fire together** in the same run — 2mo, 1mo, and 15d notifications all at once, not just the nearest one |
| J6 | Wait for the next day's cron tick (or ask for a manual re-run) without changing anything | No duplicate — each milestone only fires once per document |
| J7 | On the actual calendar day the document expires (or simulate via DB) | A separate **"...Expires Today"** notification fires — distinct from the earlier three |
| J8 | Re-verify that document with a new future expiry date | All four milestone flags reset — expect a fresh round of notifications as the new date crosses each threshold again |

## Notes while testing

- Cron-driven expiry (a **Verified** document automatically flipping to **Expired** when its date passes) can't be triggered from the UI — it runs nightly. If you want to confirm it end-to-end, verify a document with `expires_at` set to today via direct DB edit and wait for the next cron tick, or ask for a one-off manual run.
- Same applies to Journey J's near-expiry notification — it's a nightly job (`10 0 * * *`), not instant.
- Journeys D–F intentionally leave both test accounts in **Approved** status at the end, matching how they started — safe to re-run this checklist later without extra cleanup.
