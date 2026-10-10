# Employee-Cutoff PR1 Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan sequentially. Steps use checkbox syntax. Do not run cleanup batches in parallel.

**Goal:** Remove only the 16 existing PR1 roots selected by the user's employee@fortune.com and PR1-2026-0019 creation-time cutoff, together with exclusively owned request-graph records.

**Architecture:** The email and time cutoff are review selectors only. A new live audit must freeze exact UUIDs and row hashes for each request graph. Each root is then rehearsed in a rolled-back transaction, committed only after guarded checks pass, and independently verified in the database and UI.

**Tech Stack:** Supabase PostgreSQL, Supabase MCP execute_sql, PostgreSQL transactions, temporary tables, row-hash manifests, procurement UI.

---

## Status And Scope

- Status: C01 COMMITTED_UNVERIFIED. PR1-2026-0002 was deleted after a guarded rollback rehearsal and independent database postflight. C02 through C16 are not started because application/UI verification is not available in this session.
- Current selection: 16 existing PR1 roots whose requester profile email is employee@fortune.com and whose created_at is on or before PR1-2026-0019 at 24 Aug 2026, 07:28 PHT.
- Do not use email, date, request number, status, name, or purpose as a database DELETE predicate. Mutations must use only the newly frozen table-name and UUID manifest.
- Obtain a new explicit approval after the fresh audit and manifest are presented. The earlier Batch 1 approval did not include six roots that were previously held.
- PR1-2026-0001 was deleted in the earlier Batch 1 and is not in this scope.
- No backup exists for this work. An audit manifest is not a restore backup.

## Frozen Root Starting List

The following IDs were observed read-only on 05 Oct 2026. They are starting identities only and must be revalidated before execution.

| Batch | Root | UUID | Created PHT | Current status | Live / archived PR2 |
|---|---|---|---|---|---:|
| C01 | PR1-2026-0002 | 60118460-ab55-47a2-8479-e92feff98af6 | 27 Jul, 04:07 | Canvassing complete | 1 / 0 — COMMITTED_UNVERIFIED |
| C02 | PR1-2026-0005 | 03452ad7-fa46-4018-93fb-12dc313b870e | 31 Jul, 04:28 | Canvassing complete | 1 / 0 |
| C03 | PR1-2026-0006 | b51c15ec-2859-4b6e-a4b2-40b93dfd4d94 | 31 Jul, 04:29 | Canvassing complete | 1 / 0 |
| C04 | PR1-2026-0007 | 6da8db3a-423a-4791-8a74-8b408d2ac0e5 | 31 Jul, 04:32 | Canvassing complete | 1 / 0 |
| C05 | PR1-2026-0008 | df92c0a1-4cfe-496c-889a-ad51c15d475f | 31 Jul, 04:33 | Revision requested | 0 / 0 |
| C06 | PR1-2026-0009 | 0d5f756f-af08-4e9e-aa4e-98980d80db95 | 31 Jul, 04:35 | Rejected | 0 / 0 |
| C07 | PR1-2026-0010 | a15a21f5-77e3-4437-8f41-a83368d6068f | 31 Jul, 04:36 | Canvassing complete | 1 / 0 |
| C08 | PR1-2026-0011 | cca246e8-f8bc-42db-99f3-d91a1a73519d | 31 Jul, 04:41 | Canvassing complete | 1 / 8 |
| C09 | PR1-2026-0012 | fb6ca8e0-4a28-40b8-bf09-d540418e9954 | 03 Aug, 11:18 | Approved for warehouse | 0 / 0 |
| C10 | PR1-2026-0013 | 5b00fcac-5687-443f-9369-455db3d8ebd0 | 03 Aug, 11:21 | Canvassing complete | 1 / 0 |
| C11 | PR1-2026-0014 | 15b2ee69-46fa-499d-a2e7-716847963553 | 04 Aug, 15:39 | PR2 approved | 1 / 0 |
| C12 | PR1-2026-0015 | 92a8c1b1-8e09-41fd-b960-ecdb24b460b0 | 04 Aug, 16:18 | Canvassing complete | 1 / 0 |
| C13 | PR1-2026-0016 | 5469ef5f-b03b-46b1-acd5-abc0e5cb114f | 05 Aug, 08:53 | Canvassing complete | 1 / 0 |
| C14 | PR1-2026-0017 | c41494d7-1e57-4c5d-b0f6-2ae8dc6bed98 | 05 Aug, 11:43 | PR2 approved | 1 / 0 |
| C15 | PR1-2026-0018 | 91c8f8fc-ad0e-4031-9e32-1fcdff2706be | 06 Aug, 01:11 | Canvassing complete | 1 / 0 |
| C16 | PR1-2026-0019 | 42cd87ed-eb77-4c6a-a8b3-acc4be6e9a78 | 24 Aug, 07:28 | Canvassing complete | 1 / 0 |

Newly in scope since the earlier plan: PR1-2026-0006 through 0010, plus PR1-2026-0015. Their prior hold state means they need fresh ownership and business-confirmation review.

## Explicit Preservations

- All PR1s after the cutoff, including current client-created requests.
- PR1-2026-20 and PR1-2026-0021 through 0025. Their request numbers look older, but their creation times are after the cutoff.
- All independent raw-material PR2 roots where pr1_id is null, including PR2-2026-2420, 2421, and 2422.
- Users, auth identities, profiles, suppliers, departments, roles, workflows, configuration, chat/message data, and every row outside the frozen graph.
- All Storage objects. Do not delete storage.objects rows or invoke the Storage API.
- Text-only notifications or audit records that mention a request number without a verified document-ID or structured-payload relationship.

## Files

- Create: docs/superpowers/plans/2026-10-05-employee-cutoff-pr1-audit.sql
- Create: docs/superpowers/plans/2026-10-05-employee-cutoff-pr1-audit.json
- Create: docs/superpowers/plans/2026-10-05-employee-cutoff-pr1-manifest.json
- Create: docs/superpowers/plans/2026-10-05-employee-cutoff-pr1-execution.md
- Modify: this plan only after independently verified batch outcomes.

## Task 1: Run a New Read-Only Ownership Audit

- [ ] Build a root CTE with the 16 UUIDs in the table. Assert that each still resolves to its listed number, exact created_at timestamp, and profile email.
- [ ] Discover and freeze the full owned workflow graph: PR1 items and attachments; warehouse validations/items; live and archived PR2 headers/items/attachments; RFQs, supplier slots, item quotes, quote attachments, selections and substitute decisions; PO headers/items/receipts/compliance documents; deliveries/history; GRN receipts/items; approval instances/actions; notifications and audit logs directly tied to owned document IDs.
- [ ] For PR1-2026-0011, separately scan audit-log JSON payload fields for explicit PR1 UUID ownership. Do not infer historical ownership from text.
- [ ] Record every candidate row as root_id, table_name, id, and MD5 hash of to_jsonb(row). Record root metadata, per-table counts, document types, cross-boundary inbound/outbound references, shared rows, storage path references, independent PR2 roots, public columns, foreign keys, triggers, and current PR1/PR2 next-number values.
- [ ] Save the SQL and JSON files. Stop if any shared row, cross-boundary edge, document-type mismatch, unproven payload reference, or unexpected trigger is found.
- [ ] Review each root's purpose, item details, requester snapshot, and current status with the user. Graph ownership proves only technical containment, not that a request is dummy data.

## Task 2: Freeze and Approve the Exact Manifest

- [ ] Convert only audited row UUIDs and hashes into a compact manifest, grouped by C01 through C16.
- [ ] Assert the manifest includes exactly these 16 roots, excludes deleted PR1-2026-0001, and excludes PR1-2026-20 plus PR1-2026-0021 through 0025.
- [ ] Keep explicit zero counts for scoped workflow tables. Counts are assertions, never permission to broaden a delete.
- [ ] Present the final roots, row totals, archive/supplemental audit rows, retention exceptions, and Storage exclusions to the user.
- [ ] Do not begin a transaction until the user explicitly approves the newly audited 16-root manifest.

## Task 3: Rehearse C01 in a Rolled-Back Transaction

- [ ] Use a single database session. Begin a transaction; set a five-second lock timeout and 60-second statement timeout; acquire SHARE ROW EXCLUSIVE locks on every public base table.
- [ ] Rerun the ownership audit under the locks and abort unless it exactly matches root metadata, candidate IDs/hashes, schema metadata, foreign keys, trigger definitions, and sequence baselines.
- [ ] Snapshot fingerprints for every public row not in the C01 manifest.
- [ ] Run the exact deletion order using only manifest table-name and ID pairs: notifications, audit logs, approvals; GRN children/parents; delivery children/parents; compliance/PO children/parents; RFQ selections/substitutes/attachments; archived PR2 children/parents; clear scoped live PR2 quote/supplier pointers; RFQ quotes/supplier slots; clear scoped live PR2 RFQ pointers; RFQ batches; live PR2 attachments/items/headers; warehouse items/headers; PR1 attachments/items/root.
- [ ] Assert each DELETE and both scoped pointer updates affect exactly the frozen count. Do not update RFQ quote rows or disable constraints/triggers.
- [ ] Verify zero remaining frozen IDs, unchanged protected fingerprints in both directions, unchanged number sequences, and no Storage action.
- [ ] Raise a private preview exception inside a nested PostgreSQL subtransaction to roll back the rehearsal. Confirm all C01 IDs and hashes were restored. Record this proof in the execution journal.

## Task 4: Commit and Verify Sequentially

- [ ] Rerun the same guarded transaction for C01 with preview rollback disabled. Commit only after all assertions pass.
- [ ] From a new database session, require zero C01 IDs; unchanged protected roots, independent PR2 roots, configuration, and sequences.
- [ ] Verify the procurement UI: list view, a controlled not-found response for the removed root, and retained PR1/PR2/RFQ/PO/delivery/GRN/approval/notification views and attachments.
- [ ] Mark C01 COMMITTED_VERIFIED only after database and UI verification. If the transaction committed but UI verification fails, mark COMMITTED_VERIFICATION_FAILED and stop.
- [ ] Repeat exactly one batch at a time in C02 through C16 order. Never combine, skip, reset counters, or expand a manifest to make an assertion pass.

## Stop Conditions

Stop before the next batch if a root identity, profile-email association, timestamp, row hash, graph edge, trigger, count, or schema element differs from the frozen audit; if a lock times out or transaction outcome is ambiguous; if protected data changes; if any frozen ID remains; or if a retained application workflow, attachment, or UI view fails.

## Acceptance Criteria

- Only the fresh, user-approved 16 PR1 roots and their proven owned graphs are deleted.
- The six formerly held requests are removed only after the new audit and explicit approval.
- Every completed batch has a rollback rehearsal, guarded commit, independent database verification, and UI verification.
- PR1-2026-0001 remains absent; newer PR1s, PR1-2026-20/0021-0025, independent PR2 roots, and Storage all remain intact.
- The audit, manifest, execution journal, and plan statuses agree with the live database.
