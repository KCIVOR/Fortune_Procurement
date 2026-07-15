# Accreditation logic hardening — audit + phased fixes

Branch: `feat/accreditation-document-expiry`
Date: 2026-07-15
Scope: concurrency/integrity bugs found while auditing the Path B (document-level
expiry) + needs-revision work already on this branch. Does not touch product/RSE
documents, RFQ/canvassing, or any UI outside the accreditation module.

## Why this exists

After the Path B + needs-revision feature was verified structurally (migrations
applied, RLS present, `tsc` clean), a deeper logic pass traced every application-
and document-status transition function for correctness under concurrency and
stale-state conditions — not just "does the happy path work." That pass found
one data-loss bug and a systemic pattern gap. This doc records what was found
and what was changed, phase by phase, so the state is auditable later.

## Findings

| # | Severity | Where | Problem |
|---|---|---|---|
| 1 | 🔴 High | `replaceAccreditationDocumentForRevision` (lib/accreditation-documents.ts) | Guarded UPDATE (`.eq('status','needs_revision')`) can silently match 0 rows (Supabase doesn't error on a no-op update). Code didn't check this, so it would delete the **old** file from storage even when the row never actually moved — leaving the document row pointing at a deleted file and the newly uploaded file orphaned. Trigger: double-click / slow-network retry on "Replace file", or two tabs. |
| 2 | 🟠 Medium | `approveAccreditation`, `rejectAccreditation` (lib/accreditation.ts) | Final UPDATE had **no status filter at all** (`.eq('id', ...)` only) — unlike every other transition function in the file, which uses `.in('status', [...])`/`.eq('status', ...)`. A stale page or a race with a concurrent action (e.g. cron-driven revoke, another procurement user) could silently overwrite the current status. |
| 3 | 🟡 Medium | All guarded status-transition functions (submit, withdraw, mark-under-review, request-missing-docs, verify, reject, update-expiry, request-revision, revoke, reopen) | None checked the row count returned by the guarded UPDATE before writing to `audit_logs` and reporting success. A lost update (guard matches 0 rows) still produced a "success" UI message and a phantom audit-log entry that doesn't correspond to any real state change — an integrity problem specifically for a module whose job is a compliance trail. |
| 4 | 🟡 Medium | `supplier_documents_supplier_insert` RLS policy + `uploadSupplierAccreditationDocument` | Policy only checked `supplier_id = auth.uid()` — never that `accreditation_id` actually belongs to that supplier, nor that the application is still open. UI hid the upload form for withdrawn/rejected/expired applications, but that was cosmetic only; a direct API call could still insert documents against a closed application. |
| 5 | 🔵 Design note (not fixed — flagged for a product decision) | Approve → RFQ eligibility | Because Approve never blocks on document state (locked decision, D3/D4), an approved application can have every document degrade to `needs_revision`/`rejected`/`expired` with no forcing function back to re-review, and no queue/dashboard surfaces it. Accepted tradeoff, but worth a "documents need attention" badge later. |
| 6 | ⚪ Minor (not fixed) | Cron `expires_at < CURRENT_DATE` | Runs in the Postgres session timezone (UTC), while the UI date picker reflects local browser date. Day-level granularity, low practical impact for a PH-based user base. |

## Phase 1 — rowcount guards on document actions

Files: `lib/accreditation-documents.ts`

Added `.select('id')` to the guarded UPDATE in `verifyAccreditationDocument`,
`rejectAccreditationDocument`, `updateAccreditationDocumentExpiry`, and
`requestAccreditationDocumentRevision`. Each now throws
`"This document was already changed by someone else. Please refresh and try again."`
before writing to `audit_logs` if the update matched 0 rows.

## Phase 2 — fix the replace-file storage-loss bug

Files: `lib/accreditation-documents.ts` (`replaceAccreditationDocumentForRevision`)

Same rowcount check, but the consequence is different here: on a 0-row match,
the code now cleans up **only** the just-uploaded file and throws — it no
longer touches `oldPath`, since a 0-row match means the document row (and its
`file_path`) never changed. The old file stays intact and correctly referenced.

## Phase 3 — DB-level status guards on account actions

Files: `lib/accreditation.ts`

- `approveAccreditation`, `rejectAccreditation`, `requestMissingDocuments` — added
  `.in('status', ['submitted','under_review','missing_documents'])` to the final
  UPDATE (previously missing entirely on approve/reject; missing on request-missing-docs).
- All 8 status-transition functions (`submitAccreditation`, `withdrawAccreditation`,
  `markAccreditationUnderReview`, `requestMissingDocuments`, `approveAccreditation`,
  `rejectAccreditation`, `revokeAccreditation`, `reopenAccreditationForReview`) now
  check the UPDATE's row count and throw
  `"This application was already updated. Please refresh and try again."` on a
  lost update, before writing the audit-log entry.

## Phase 4 — enforce closed-application upload block server-side

- `lib/accreditation-documents.ts`: `uploadSupplierAccreditationDocument` now
  fetches the parent accreditation's status first and throws a clear error
  (`"This application is closed. Start a new application to upload documents."`)
  if it's `withdrawn`/`rejected`/`expired`.
- New migration `supabase/migrations/20260715051323_accreditation_document_insert_guard.sql`
  tightens `supplier_documents_supplier_insert`: for accreditation-scoped rows
  (`accreditation_id IS NOT NULL AND supplier_product_id IS NULL`), the `WITH CHECK`
  now requires the accreditation to belong to the inserting supplier **and** be
  in a non-closed status. Product/RSE document inserts are untouched.
- Applied live via Supabase MCP `apply_migration` to project `emddvbocupvufzvhcacz`
  (Fortune Procurement). Local migration file renamed to the remote-assigned
  version (`20260715051323`) so `supabase migration list` shows it in sync on
  both sides — confirmed via `supabase migration list`.

## Phase 5 — verification

- `npx tsc --noEmit` — clean, no errors.
- Live DB re-check via Supabase MCP:
  - `supplier_documents_supplier_insert` policy `WITH CHECK` matches the migration exactly.
  - `get_advisors(security)` — same pre-existing warnings as before this work (search_path,
    security-definer RPCs, leaked-password-protection); nothing new introduced.
- Confirmed no other call sites depend on the old (unguarded) update behavior —
  all 13 touched functions are used only through their existing UI action buttons,
  which already gate on the same status set client-side.

## Deliberately not touched

- Finding #5 (no forcing function back to re-review once approved) — product
  decision, not a code bug. Needs a human call before building a "needs attention"
  view.
- Finding #6 (cron timezone) — low severity, no clear "correct" fix without a
  product decision on what "day" means for expiry.
- `updateAccreditationExpiry` (lib/accreditation.ts) — confirmed dead code (zero
  UI callers), intentionally left per the original Path B plan pending a later
  cleanup pass. Not touched here to avoid unrelated scope creep.
- Pre-existing local/remote filename drift on the two earlier migrations in this
  branch (`20260715120000_document_expiry_cron.sql` vs remote `20260715022526`,
  `20260715140000_document_needs_revision.sql` vs remote `20260715033218`) —
  predates this work; only the migration touched in Phase 4 was reconciled.

## Files changed

- `lib/accreditation-documents.ts` — Phases 1, 2, 4
- `lib/accreditation.ts` — Phase 3
- `supabase/migrations/20260715051323_accreditation_document_insert_guard.sql` — Phase 4 (new, applied live)

## Addendum — reject requires a remark; near-expiry notifications

Two follow-ups requested same day, same branch:

**Reject now requires a remark.** `rejectAccreditationDocument` takes a required
`reason`, stored on the existing `revision_note` column (reused, not a new
column) and shown to both procurement ("Rejection reason:") and the supplier
("Reason:"). Unlike needs-revision, a rejected document still has no fix path —
the remark is explanatory only. UI: `app/accreditation/[id]/page.tsx` opens an
inline remark panel on Reject, same pattern as Needs revision.

**Near-expiry notifications — 4 milestones (2mo / 1mo / 15d / day-of).** Audit
confirmed the expiry cron only ever flipped `status` — no one was ever
notified, at expiry or before it, for any document action. First pass added a
single 2-month window notification; follow-up request expanded it to four
independent checkpoints. Added:

- `supplier_documents.notified_60d_at`, `notified_30d_at`, `notified_15d_at`,
  `notified_0d_at` (four columns, replacing the earlier single
  `expiry_notified_at`) — each set once its milestone notification has fired;
  all four cleared together by the app layer (`verifyAccreditationDocument`,
  `updateAccreditationDocumentExpiry`, `rejectAccreditationDocument`,
  `requestAccreditationDocumentRevision`, `replaceAccreditationDocumentForRevision`)
  any time `expires_at` is set, changed, or cleared — so a renewed document
  gets a fresh cycle through all four checkpoints for its new date.
- `public.notify_accreditation_documents_near_expiry()` — same cron job
  (`notify-accreditation-documents-near-expiry`, daily `10 0 * * *`, right
  after the expiry job), rewritten to check all four thresholds independently
  each run: `expires_at <= today + 2 months`, `+ 1 month`, `+ 15 days`, and
  `= today`. Each is its own flag, so they don't block each other — a document
  verified with only 10 days left catches up on the 2mo/1mo/15d milestones
  together in one run, all skipping only whichever it's already past.
- `REVOKE ALL ... FROM PUBLIC` on the function — only callable by the DB owner
  (pg_cron), not exposed as a client-callable RPC.
- Migrations: `20260715054550_document_near_expiry_notifications.sql` (first
  pass, single window) then `20260715060255_document_expiry_notification_milestones.sql`
  (both applied live; local filenames match the remote-assigned versions).

Verified live against the same real document (expires 2026-07-17, 2 days out
at test time): manually invoking the function fired the 2mo, 1mo, and 15d
milestones simultaneously (catch-up behavior confirmed), correctly withheld
day-of (expiry date ≠ today), and a second run added zero new rows across all
three fired milestones (idempotent).

Deliberately not built: actual emails (this app has no email channel at all,
in-app `notifications` table only) and a dashboard/badge surfacing "documents
near expiry" outside the notification bell — both would be separate asks.

## Addendum 2 — resubmission allowed on rejected documents

Follow-up audit found Reject was a soft dead end in practice: the rejected row
itself couldn't be updated by the supplier (RLS scoped to `needs_revision`
only), but nothing stopped a fresh duplicate upload of the same
`document_type` via the normal upload button either — no unique constraint on
`(accreditation_id, document_type)`, and `uploadSupplierAccreditationDocument`
never checked for an existing rejected doc of that type. So Reject was
silently workaroundable, just clumsily (two rows, old one stuck Rejected
forever). Decision: make Reject an explicit "harder needs-revision" instead —
same resubmit mechanics, same single-row in-place replace, no application-status
side effect.

- `replaceAccreditationDocumentForRevision` renamed to
  `resubmitAccreditationDocument` (`lib/accreditation-documents.ts`) — now
  accepts source status `needs_revision` **or** `rejected`; audit log payload
  gained `prior_status` so the trail still shows which path a resubmission
  came from.
- RLS: `supplier_documents_supplier_update_needs_revision` renamed to
  `supplier_documents_supplier_resubmit`, `USING` widened to
  `status IN ('needs_revision', 'rejected')`. `WITH CHECK` unchanged — still
  must land on `uploaded` + `revision_note`/`expires_at` cleared.
- UI: supplier's document row now shows the resubmit control on `rejected`
  too (labeled "Resubmit file" vs "Replace file" for needs_revision, same
  underlying action). Procurement's Reject panel copy updated — no longer
  claims "no fix path."
- Migration: `supabase/migrations/20260715061516_document_resubmit_after_reject.sql`
  (applied live; local filename matches remote-assigned version — confirmed
  via `pg_policies`, old policy gone, new one present with correct scope).

## Addendum 3 — resubmission allowed while Pending too

Screenshot-driven bug report: a document still `uploaded` (Pending, never
acted on by procurement) had no replace path either — same gap as rejected
had, just one stage earlier. `resubmitAccreditationDocument` and the
`supplier_documents_supplier_resubmit` RLS policy widened once more, this
time to `status IN ('uploaded', 'needs_revision', 'rejected')`. `WITH CHECK`
unchanged. UI: the resubmit control (`app/supplier/accreditation/page.tsx`)
now also shows on Pending documents, labeled "Replace file" (same as
needs-revision; "Resubmit file" stays reserved for rejected).

Migration: `supabase/migrations/20260715062514_document_resubmit_while_pending.sql`
(applied live). Verified live: temporarily flipped one of the user's own real
test documents (`images (8).jpg`, rejected → uploaded) and re-ran the exact
UPDATE `resubmitAccreditationDocument` performs — guard matched, row updated
correctly — then restored the document to its original state.

With this, `resubmitAccreditationDocument` now covers every document status
that isn't a terminal application decision or already-actioned by
procurement (`accepted`/`expired` still correctly excluded — a verified or
already-expired document isn't meant to be silently swapped).
