# PR1 Test Data Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline and sequentially; no parallel deletion batches.

**Goal:** Remove only business-confirmed dummy request roots and their exclusively owned records, one complete request graph per transaction, while preserving client data.

**Architecture:** Audit first, freeze an exact UUID-and-row-hash manifest, test the guarded runner, then execute the queue below in order. Each batch is atomic; transactions do not span independent MCP calls. Storage is excluded from database cleanup and has a separate review gate.

**Tech Stack:** Supabase Postgres, Supabase MCP `execute_sql`, PostgreSQL transactions, existing application workflow code.

---

## Current Status

- Project: Fortune Procurement, `emddvbocupvufzvhcacz`.
- Latest independent post-B01 live audit: 02 Oct 2026, 16:53 Asia/Manila (2026-10-02T08:53:33.270583+00:00).
- Completed: read-only ownership graph, foreign-key and named application-link checks, document-type checks, per-root counts, exact candidate row IDs and content hashes, historical-reference scan, and local plan revision.
- Authorized scope: the user requested deletion of the 11 listed root requests and described linked records in this chat. This authorizes that exact scope, not a broader cutoff or uncertain notifications.
- B01 (`PR1-2026-0001`) is **COMMITTED_UNVERIFIED**: 157 approved rows deleted in one guarded transaction; exact-count rollback rehearsal passed; independent database postflight passed. Application/UI verification has not been completed, so the queue is stopped and B02 has not started.
- Client write-pause confirmation remains unverified. During B01, the transaction acquired `SHARE ROW EXCLUSIVE` locks on all 51 public base tables with a five-second lock timeout, temporarily queuing database writes. This does not prove external writers or non-database side effects were paused outside that transaction.
- No isolated Docker test environment was available. The guarded B01 operation sequence was behaviorally rehearsed against the live database inside a nested transaction that was deliberately rolled back, then run once for commit. No standalone reusable runner file was created.
- Remaining production mutations, application verification, and Storage review are not complete. Authorization covers the exact list, but does not establish that every candidate is objectively dummy data.
- Backup: user explicitly waived creating one. No verified restorable backup was created. The audit JSON contains IDs, limited request metadata and hashes, not full rows or a restore mechanism.
- No percentage can honestly quantify success from these checks. Earlier confidence percentages were not statistically established. Neither this audit nor SQL parsing proves 100% safety.

### Audit Artifacts

- Read-only reproducible SQL: `docs/superpowers/plans/2026-10-02-pr1-cleanup-audit.sql`.
- Observed manifest/report: `docs/superpowers/plans/2026-10-02-pr1-cleanup-audit.json`.
- This plan replaces the previous all-candidates-in-one-transaction plan.
- Frozen scope manifest: `docs/superpowers/plans/2026-10-02-pr1-proposed-deletion-list.json` (compact v2, 1,516 ordinary rows plus two separately labeled B04 historical audit rows).
- Execution journal: `docs/superpowers/plans/2026-10-02-pr1-cleanup-execution.md`.

## Findings Corrected

1. The legacy cutoff contains **23 roots**, not 22. A cutoff, shared email, or requester name must never select rows for deletion.
2. `PR1-2026-0015` contains only "Description" / "Remarks", with no explicit test/demo marker. It is now held, reducing marker candidates from 12 to **11**.
3. There are **three independent raw-material PR2 roots** with `pr1_id IS NULL`: `PR2-2026-2420`, `PR2-2026-2421`, and `PR2-2026-2422`. PR2 records are not universally generated PR1 descendants. Preserve these roots and their graphs.
4. `RFQ_QUOTE` audit events can reference a supplier-slot ID, not just a quote ID. Include both `rfq_suppliers.id` and `rfq_item_quotes.id` in the document manifest. Source: `lib/canvassing.ts:1787` and `lib/canvassing.ts:3655`.
5. RFQs must also be discovered through owned live/archive PR2 `rfq_id` pointers, not just RFQ `pr1_id` / `pr2_id`.
6. The old "assertions" only returned counts. The runner must raise an exception on failure; an unconditional trailing COMMIT is unacceptable.
7. Checking warehouse items through already deleted warehouse parents can falsely return zero. Freeze child UUIDs before mutation and query those UUIDs afterward.
8. SQL PREPARE/parsing did not execute a deletion and did not validate cascades, cycle-breaking, concurrency, or UI behavior.
9. Some historical document IDs no longer exist. Current parent-ID selection alone does not remove every old notification/audit event.
10. `scratch/cleanup-pipeline-data.mjs` deletes whole tables, including chat data. `delete_pr1.mjs` hardcodes another request and has inadequate error handling. **Do not run either script, adapt their global selectors, or use broad type/email/prefix deletion.**

## Scope And Ownership

**Approved deletion scope:** the 11 entries in the queue and their described exclusively owned records, as authorized by the user's latest request. This is not authorization for any held root or historical notification exception. Exact observed UUIDs are mandatory; request numbers are labels and an additional identity check.

**Held legacy roots:** `PR1-2026-0006`, `PR1-2026-0007`, `PR1-2026-0008`, `PR1-2026-0009`, `PR1-2026-0010`, `PR1-2026-0015`, `PR1-2026-20`, `PR1-2026-0021`, `PR1-2026-0022`, `PR1-2026-0023`, `PR1-2026-0024`, `PR1-2026-0025`.

Preserve all roots outside the current approved batch, including the 12 held roots, newer PR1s, other candidate batches, independent PR2s, and every graph belonging to them. Preserve users/auth, profiles, supplier accounts/accreditations/products/documents, RSE/TSQA, workflows/steps, controlled forms/versions, roles/permissions, departments/positions, VAT/SMTP configuration, wishlist, bug reports, conversations/messages/message attachments, and all Storage objects.

No shared master row becomes deletable because it is referenced by a dummy request.

### Live Graph Evidence

The single-snapshot audit found:
- 23 reviewed legacy PR1 roots.
- 11 marker candidates with **1,516 directly linked rows** across 28 scoped tables; zero-count tables are absent from each footprint and must be treated as expected zero.
- Two additional, structured-payload-owned historical audit rows for B04. Planned total with these two rows is **1,518**, if all 11 candidates are business-confirmed.
- **Zero cross-boundary edges**, **zero shared scoped rows**, and **zero document-type mismatches** under the inspected relationships.
- Relationship coverage: catalog foreign keys for these tables, plus non-FK RFQ-to-PR1, quote/selection-to-PR1-item, and PO-to-approval-instance links. Catalog contains 120 FKs involving public schema; 51 workflow-to-workflow checks include four named non-FK links.
- 29 text-matched candidate notifications refer to absent/different historical document UUIDs. They are **not** automatically owned by the current UUID just because their body repeats its request number.
- 35 database file-path references across all 23 roots, including 10 candidate references. These are references, not verified existing Storage objects; do not equate reference count with object count.
- Only observed custom workflow trigger: AFTER UPDATE on `rfq_item_quotes`, invoking `unselect_selections_on_quote_change`. Avoid updating quote rows. No custom DELETE trigger was observed on scoped tables; recheck before execution.
- Observed next-number values: PR1 `0049`, PR2 `2423`. Never reset counters or renumber retained records; test numbering behavior after each batch.

The audit is bounded to the observed database schema and inspected code paths. It is not proof that external jobs, webhooks, cached links, other applications, or reused historical numbers have no references.

### Candidate Evidence And Counts

All 23 legacy roots resolve to `employee@fortune.com`; this is attribution, not a dummy-data classifier. Dates in the queue are creation dates in Asia/Manila.

| Root | Explicit marker | Live / archive PR2s | Approval instances | Notifications | Audit rows including structured supplement |
|---|---|---:|---:|---:|---:|
| PR1-2026-0001 | Test description | 1 / 0 | 4 | 92 | 30 |
| PR1-2026-0002 | Test Item | 1 / 0 | 4 | 94 | 30 |
| PR1-2026-0005 | Test Desc 1 / Test Desc 2 | 1 / 0 | 6 | 181 | 45 |
| PR1-2026-0011 | Test Desc 1 | 1 / 8 | 12 | 119 | 75 |
| PR1-2026-0012 | Test Item | 0 / 0 | 1 | 15 | 6 |
| PR1-2026-0013 | Test Item | 1 / 0 | 3 | 40 | 20 |
| PR1-2026-0014 | Test Description | 1 / 0 | 2 | 27 | 15 |
| PR1-2026-0016 | Test | 1 / 0 | 4 | 105 | 29 |
| PR1-2026-0017 | Test Desc | 1 / 0 | 2 | 25 | 12 |
| PR1-2026-0018 | AITEST-A in purpose | 1 / 0 | 3 | 59 | 22 |
| PR1-2026-0019 | Demo Description / Demo Remarks | 1 / 0 | 4 | 101 | 31 |

## Ordered Batch Queue

**Batch unit: one root and its entire approved descendant/reference graph.** Do not commit table-by-table; that would leave half-deleted workflows. Queue is oldest creation first, with UUID as tie-breaker.

| Batch | Root | Frozen root UUID | Created (PHT) | Planned DB rows | Status |
|---|---|---|---|---:|---|
| B01 | PR1-2026-0001 | `d8b600b4-360d-4209-9664-e73bc9916eb7` | 22 Jul 2026, 14:22 | 157 | COMMITTED_UNVERIFIED |
| B02 | PR1-2026-0002 | `60118460-ab55-47a2-8479-e92feff98af6` | 27 Jul 2026, 04:07 | 161 | NOT_STARTED (blocked pending B01 application verification) |
| B03 | PR1-2026-0005 | `03452ad7-fa46-4018-93fb-12dc313b870e` | 31 Jul 2026, 04:28 | 283 | NOT_STARTED |
| B04 | PR1-2026-0011 | `cca246e8-f8bc-42db-99f3-d91a1a73519d` | 31 Jul 2026, 04:41 | 260 | NOT_STARTED |
| B05 | PR1-2026-0012 | `fb6ca8e0-4a28-40b8-bf09-d540418e9954` | 03 Aug 2026, 11:18 | 28 | NOT_STARTED |
| B06 | PR1-2026-0013 | `5b00fcac-5687-443f-9369-455db3d8ebd0` | 03 Aug 2026, 11:21 | 81 | NOT_STARTED |
| B07 | PR1-2026-0014 | `15b2ee69-46fa-499d-a2e7-716847963553` | 04 Aug 2026, 15:39 | 56 | NOT_STARTED |
| B08 | PR1-2026-0016 | `5469ef5f-b03b-46b1-acd5-abc0e5cb114f` | 05 Aug 2026, 08:53 | 169 | NOT_STARTED |
| B09 | PR1-2026-0017 | `c41494d7-1e57-4c5d-b0f6-2ae8dc6bed98` | 05 Aug 2026, 11:43 | 50 | NOT_STARTED |
| B10 | PR1-2026-0018 | `91c8f8fc-ad0e-4031-9e32-1fcdff2706be` | 06 Aug 2026, 01:11 | 102 | NOT_STARTED |
| B11 | PR1-2026-0019 | `42cd87ed-eb77-4c6a-a8b3-acc4be6e9a78` | 24 Aug 2026, 07:28 | 171 | NOT_STARTED |

B04 includes two separately reviewed historical audit rows, so its planned count is 260 rather than its directly linked count of 258. Counts are observed baselines, not permissive deletion limits.

No batch may start until its preceding batch is COMMITTED_VERIFIED. If a batch fails or needs scope review, stop the queue. Do not skip ahead, combine roots, or expand the graph to resolve a conflict.

## Historical Record Disposition

### Structured Audit Supplement: B04 Only

Source `lib/pr2-warehouse.ts:196` writes `PR2_CREATED_FROM_WAREHOUSE` with explicit `payload.pr1_id`.

Include these exact rows in B04 only after the root is confirmed for deletion:
- `6aa7010f-07dc-4cec-ab31-f34caf994f33`; historical PR2 document `73fbfc4f-8ebd-4f85-ac4c-33dcfbd6dd28`.
- `b43a4bfc-dd76-415d-ab8b-3137f2861c6e`; historical PR2 document `24face6b-fc52-4ece-aef7-7e43d72f8245`.

Require exact row hashes from `supplemental_audit_rows_require_manifest`, action/type unchanged, `payload->>'pr1_id' = 'cca246e8-f8bc-42db-99f3-d91a1a73519d'`, and no retained workflow ownership of either historical document ID. Do not add other records based solely on matching text.

### Notification Holds

Default disposition: PRESERVE_UNRESOLVED. The report stores exact hint row IDs; these are outside the 1,518-row planned graph.

| Candidate mentioned in text | Notifications held |
|---|---:|
| PR1-2026-0001 | 1 |
| PR1-2026-0017 | 2 |
| PR1-2026-0018 | 1 |
| PR1-2026-0019 | 25 |

Their current document IDs do not resolve to live PR1s. Matching numbers might refer to an earlier incarnation or unrelated record. Do not delete by LIKE, body/title, missing-parent status, or email. A separate reviewed exact-row allowlist is needed if their ownership can be established. Until then, report them as retained historical exceptions and do not claim that every trace of dummy activity is gone.

## Execution Attempt: 2026-10-02 07:34:56 UTC

- Fresh read-only audit at 2026-10-02T07:30:32.775134+00:00: all 23 reviewed roots and 1,516 linked candidate rows remain; no manifest additions, removals or content changes; no schema/FK/trigger drift; zero cross-boundary edges, shared rows or document-type mismatches.
- Correct project independently verified as Fortune Procurement, ACTIVE_HEALTHY; SQL role postgres. No deployed Edge Functions were listed.
- Two enabled cron jobs exist (supplier-document expiry at 00:00 UTC and expiry notifications at 00:10 UTC). They were inspected but not modified. Their existence is not proof that all background writers are paused.
- No public rewrite rules were found; public base-table count is 51. Observed custom workflow trigger remains the quote AFTER UPDATE trigger.
- Local Docker executable is present, but its Linux engine pipe is absent; no psql/postgres/pg_ctl executable was found on PATH. No isolated deletion tests were run.
- Requested confirmation that client edits and background procurement jobs are paused; no confirmation has been received at the time of this record.
- Stop condition applies before B01. All roots, dependents, historical notification holds, users/master data and Storage objects remain unchanged by this execution attempt.
- Execution journal: `docs/superpowers/plans/2026-10-02-pr1-cleanup-execution.md`.
- Do not mark the runner tested, any batch committed, or the overall cleanup complete. Resume with runner implementation and isolated tests, then verify the maintenance window before B01.

## Task 1: Complete And Record The Read-Only Audit

**Files:** the audit SQL/JSON and this plan.

- [x] Enumerate the 23 explicit legacy root labels and inspect purpose/items/remarks and requester attribution.
- [x] Read live columns, foreign keys, trigger definitions, and nullable cycle-breaking columns.
- [x] Build ownership sets for roots, items/attachments, warehouse, live/archive PR2, RFQ/supplier/quotes/attachments/selections/substitutes, PO/items/receipts/compliance, deliveries/history, GRNs/items, approvals/actions, notifications, audit logs.
- [x] Check incoming and outgoing workflow relationships for another root/unowned row; inspect the four named non-FK links.
- [x] Check document-type normalization against its scoped UUID. Notifications may use lower-case types; normalize case only, not arbitrary aliases.
- [x] Capture candidate row IDs/content hashes and table count/ID/content fingerprints.
- [x] Scan audit payloads and notification text/URLs for residual reference hints; inspect candidate exceptions.
- [x] Save a reproducible read-only SELECT and the observed JSON report.
- [x] Update this plan to sequential one-root transactions and hold uncertain data.

Expected result: audit evidence is available; execution remains NOT_STARTED.

## Task 2: Freeze Business-Confirmed Scope And Build The Runner

**Files:** create `scripts/cleanup-confirmed-test-pr1s.sql`; create the execution journal.

- [x] Record the user's authorization to delete the exact 11 listed root UUIDs and their described linked records. Keep held roots and unproven notification exceptions excluded; no new backup is requested by this plan.
- [ ] Record notification exceptions as PRESERVE_UNRESOLVED unless separately proven and explicitly included. Include only B04's two structured audit supplements as described above.
- [ ] Build a single-connection script from the saved read-only ownership SELECT, using one selected root UUID/number and the reviewed JSON manifest. Use structured JSON parsing (`jsonb_to_recordset`) for manifest import, not handwritten ID lists for descendants.
- [ ] Re-run the saved audit after obtaining transaction locks. Store its returned JSON as the observed manifest in the same connection. Compare only the current batch against its reviewed expected manifest; previous committed batches will no longer exist.
- [ ] Implement exception-raising checks and the child-first operation schedule below. Keep the script's default ending ROLLBACK while testing. Production COMMIT is allowed only after all in-transaction assertions succeed.
- [ ] Record artifact content hashes, project ref, root ID, reviewed audit timestamp and scope disposition in the journal before execution.

### Runner Data Contract

Temporary tables are transaction-local and `ON COMMIT DROP`:
- `cleanup_config`: one row with batch ID, root UUID, root number, business-confirmed flag, reviewed `audit jsonb`, schema/trigger metadata and planned counts.
- `cleanup_observed`: one `audit jsonb` returned by the unchanged saved audit SELECT, after locks.
- `cleanup_scope(table_name text, id uuid, row_hash text)`: exact selected-root entries from `candidate_id_manifest`, plus the two B04 supplement IDs/hashes only for B04; primary key `(table_name,id)`.
- `cleanup_protected(table_name text,id text,row_hash text)`: fingerprints of every public-table row outside this batch, captured before mutation.
- `cleanup_public_tables(table_name text primary key)`: all observed 51 public base tables, compared to the live catalog before locking.
- `cleanup_operation_results`: ordered operation name, expected count, actual count and status. Return this metadata to the journal; do not store full row backups.

Manifest import for an individual batch is:

```sql
insert into cleanup_scope (table_name,id,row_hash)
select m.table_name,m.id,m.row_hash
from cleanup_config c
cross join lateral jsonb_to_recordset(c.audit->'candidate_id_manifest')
  as m(root_id uuid,table_name text,id uuid,row_hash text)
where m.root_id=c.root_id;

insert into cleanup_scope (table_name,id,row_hash)
select 'audit_logs',m.id,m.content_hash
from cleanup_config c
cross join lateral jsonb_to_recordset(
  c.audit->'supplemental_audit_rows_require_manifest'
) as m(id uuid,root_id uuid,content_hash text)
where m.root_id=c.root_id;
```

Before any mutation, compare observed ownership IDs to the expected selected-root IDs in BOTH directions using EXCEPT; a count-only match is insufficient. Compare original content hashes for every manifest row and expected zero counts for absent tables. Revalidate supplemental rows individually; they do not appear in the ordinary ownership graph.

### Connection, Locks And Exceptions

Run the entire batch as one bounded script on one connection. Do not use an MCP call for BEGIN and another for deletion/COMMIT; session reuse is not guaranteed.

```sql
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
set local idle_in_transaction_session_timeout='60s';

create function pg_temp.assert_true(ok boolean,message text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception '%',message;
  end if;
end;
$$;

do $$
declare r record;
begin
  for r in select table_name from cleanup_public_tables order by table_name loop
    execute format(
      'lock table public.%I in share row exclusive mode',r.table_name
    );
  end loop;
end;
$$;
```

Create/import the temporary contract tables before the lock block. Validate table names against the audited catalog and live catalog; never accept arbitrary identifiers from user data. Lock all public tables in consistent alphabetical order during this maintenance operation to protect both the graph and unrelated-row fingerprint comparison. Keep human review and UI testing outside the transaction. A lock timeout, SQL error, unexpected duration or missing table aborts the batch.

Maintenance must stop application/API writes, active workflows, cron/Edge Function writers, webhooks and other writers for the batch. Row locks alone cannot protect non-FK notifications/audit links. If a write freeze cannot be verified, do not execute. Inspect database hooks/events again; do not assume PostgreSQL rollback reverses external HTTP/queue side effects.

### Protected-Row Capture

For each audited public table, read `id::text` and `md5(to_jsonb(row)::text)`, excluding only UUIDs in this batch's `cleanup_scope` for that table. Store hashes, not row values. This covers held roots, future batches, independent PR2 descendants, chat data and shared masters.

```sql
do $$
declare r record;
begin
  for r in select table_name from cleanup_public_tables order by table_name loop
    execute format(
      'insert into cleanup_protected(table_name,id,row_hash)
       select %L,x.id::text,md5(to_jsonb(x)::text)
       from public.%I x
       where not exists (
         select 1 from cleanup_scope s
         where s.table_name=%L and s.id::text=x.id::text
       )',r.table_name,r.table_name,r.table_name
    );
  end loop;
end;
$$;
```

Recompute the same relation after mutation and compare BOTH directions. Fail if any unrelated row was deleted, modified or inserted. Verify user/auth and Storage metadata counts/identities separately as protected, without exposing credentials or exporting their contents. No statement in the runner may mutate those schemas.

## Task 3: Test Fail-Closed Behavior Before Production

**Files:** runner and execution journal. Tests run in an isolated disposable schema/database with the audited relationships and synthetic data, not destructive rehearsals against the client database.

- [ ] Happy path: one synthetic PR1 graph with live/archive PR2, bidirectional RFQ pointers, both item/quote pointers, approval actions and all attachment tables. Expect all scoped rows absent after cleanup, unrelated hashes identical, then ROLLBACK restores the synthetic graph.
- [ ] Ownership conflict: a retained PR2 item references a targeted PR1 item. Expect the inbound-edge check to raise BEFORE any delete; retained rows and the target remain.
- [ ] Application-link conflict: a retained RFQ or quote/selection uses a targeted PR1/root item without an FK. Expect the named-link check to raise.
- [ ] Shared RFQ: two roots point at one RFQ. Expect shared-row detection to raise; never merge the roots automatically.
- [ ] Identity drift: replace one manifest UUID with a different UUID while keeping counts identical. Expect bidirectional set comparison to raise.
- [ ] Content drift: modify purpose/description/status or notification read state after review. Expect row-hash comparison to raise; no automatic acceptance of the new snapshot.
- [ ] Cascade expansion: add an unexpected child relation/row. Expect metadata or inbound-edge checks to raise; protected fingerprint failure must also prevent COMMIT.
- [ ] Historical records: structured exact-root audit supplement is removed only in its approved batch; text-only notification hints remain untouched.
- [ ] Concurrency: a second connection attempts a public workflow write while locks are held. Expect writer blocking/timeout and no unseen new reference inside the batch.
- [ ] Forced error: raise after a middle delete. Expect transaction rollback, zero durable batch deletions and no later batch dispatch.
- [ ] Unknown outcome: simulate a lost response around COMMIT. Expect status UNKNOWN, stop dispatch, and a read-only exact-manifest reconciliation; never blind-retry.
- [ ] Rerun: an already committed root is absent. Expect rejection as ALREADY_EXECUTED/ABSENT, not silent success or selector expansion.
- [ ] Queue ordering: B02 cannot start when B01 is anything other than COMMITTED_VERIFIED.
- [ ] Numbering: deleting synthetic lower-numbered requests must not alter the next value while retained highest-numbered requests remain.

Record actual test outputs and schema version/hash in the journal. PREPARE, EXPLAIN, zero deletion triggers and a read-only audit are not substitutes for these tests. If a matching isolated environment is unavailable, mark behavioral validation incomplete and do not label the runner production-ready.

## Task 4: Execute Each Approved Batch In Order

**Files:** runner and execution journal. Repeat this entire task for B01 through B11 without overlapping batches.

- [ ] Set current batch status PREFLIGHT; verify previous batch COMMITTED_VERIFIED (B01 has no predecessor).
- [ ] Verify project ref, confirmed root UUID/number, unchanged explicit evidence, exact count/ID/content manifests, metadata, trigger definitions and expected supplemental hashes.
- [ ] Verify maintenance/write freeze; enter one transaction, acquire locks, rerun ownership/reference checks and capture protected fingerprints.
- [ ] Execute the operation schedule, tracking exact affected counts.
- [ ] Run machine-enforced postflight before COMMIT.
- [ ] Commit only after all checks pass; record COMMITTED_UNVERIFIED and verify independently in Task 5.
- [ ] On any known SQL failure, roll back and record ROLLED_BACK. On a lost/ambiguous response, record UNKNOWN and reconcile read-only before any retry or next batch.

### Exact Mutation Order

Every delete uses `cleanup_scope.table_name + id`, never a date, email, wildcard, status, type-only filter or freshly broadened parent predicate.

1. Notifications, audit logs, approval actions, approval instances.
2. GRN items, GRN receipts, delivery status history, deliveries.
3. Compliance documents, PO receipts, PO items, PO requests.
4. Supplier item selections, substitute decisions, RFQ quote attachments.
5. Archive PR2 items, archive PR2 headers.
6. Clear `rfq_item_quote_id` and `selected_rfq_supplier_id` on scoped live PR2 items only.
7. RFQ item quotes, RFQ supplier slots.
8. Clear `rfq_id` on scoped live PR2 headers only.
9. RFQ batches, live PR2 item attachments, live PR2 items, live PR2 headers.
10. Warehouse validation items, warehouse validations, PR1 attachments, PR1 items, root PR1.

This order explicitly removes attachment/item rows before their cascading parents, preventing uncounted cascade deletion. Do not update RFQ quotes, disable triggers/constraints, change masters, or null references on retained rows.

Reference deletion helper (called only in the schedule above):

```sql
create function pg_temp.delete_scoped(target_table text)
returns bigint language plpgsql as $$
declare expected bigint; actual bigint;
begin
  select count(*) into expected from cleanup_scope
    where table_name=target_table;
  perform pg_temp.assert_true(
    target_table=any(array[
      'notifications','audit_logs','approval_actions','approval_instances',
      'grn_items','grn_receipts','delivery_status_history','deliveries',
      'compliance_documents','po_receipts','po_items','po_requests',
      'supplier_item_selections','substitute_decisions',
      'rfq_quote_attachments','pr2_items_archive','pr2_requests_archive',
      'rfq_item_quotes','rfq_suppliers','rfq_batches',
      'pr2_item_attachments','pr2_items','pr2_requests',
      'warehouse_validation_items','warehouse_validations',
      'pr1_attachments','pr1_items','pr1_requests'
    ]),'unexpected delete table'
  );
  execute format(
    'delete from public.%I x using cleanup_scope s
     where s.table_name=%L and x.id=s.id',
    target_table,target_table
  );
  get diagnostics actual=row_count;
  perform pg_temp.assert_true(actual=expected,
    format('%s: expected %s deletes, got %s',
      target_table,expected,actual));
  return actual;
end;
$$;
```

Cycle-breaking updates:

```sql
do $$
declare expected bigint; actual bigint;
begin
  select count(*) into expected from cleanup_scope
    where table_name='pr2_items';
  update public.pr2_items x
  set rfq_item_quote_id=null,selected_rfq_supplier_id=null
  from cleanup_scope s
  where s.table_name='pr2_items' and x.id=s.id;
  get diagnostics actual=row_count;
  perform pg_temp.assert_true(actual=expected,
    'unexpected scoped PR2 item update count');
end;
$$;

do $$
declare expected bigint; actual bigint;
begin
  select count(*) into expected from cleanup_scope
    where table_name='pr2_requests';
  update public.pr2_requests x
  set rfq_id=null
  from cleanup_scope s
  where s.table_name='pr2_requests' and x.id=s.id;
  get diagnostics actual=row_count;
  perform pg_temp.assert_true(actual=expected,
    'unexpected scoped PR2 header update count');
end;
$$;
```

Place these two updates at steps 6 and 8 respectively, not together at the beginning. Assert each UPDATE's affected-row count against the frozen scoped table count. Verify nullable columns and observed trigger metadata before using them.

### In-Transaction Postflight

- [ ] For all 28 workflow tables, query frozen UUIDs directly, including child IDs whose parents are already deleted. Raise if any remain.
- [ ] Re-scan non-FK/document links for the frozen document UUIDs, including supplier-slot IDs, plus approved historical document IDs. Raise if an unapproved retained row still points to a newly deleted document.
- [ ] Compare protected rows in BOTH directions (row identity and content hash). Held/newer roots, other queued batches, independent PR2 graphs and masters must match exactly.
- [ ] Require all operation affected counts to match the reviewed manifest, including expected zero tables.
- [ ] Check next-number functions against the pre-batch baseline and verify no workflow/permission configuration changed.
- [ ] Require unchanged Storage metadata and no Storage API call or external mutation in this script.

The final remaining-row check must enforce failure:

```sql
do $$
declare r record; remaining bigint;
begin
  for r in
    select distinct table_name from cleanup_scope order by table_name
  loop
    execute format(
      'select count(*) from public.%I x join cleanup_scope s
       on s.id=x.id where s.table_name=%L',r.table_name,r.table_name
    ) into remaining;
    perform pg_temp.assert_true(remaining=0,
      format('remaining frozen rows in %s: %s',r.table_name,remaining));
  end loop;
end;
$$;
```

Do not substitute a SELECT-only warning followed by COMMIT. In production, COMMIT must be reachable only after every guard completes; any exception aborts the transaction. Committed batches are not reversible without recovery data, and a later failure does not undo earlier committed batches.

## Task 5: Verify And Journal Before Advancing

**Files:** execution journal and this plan's queue.

- [ ] Independently query the committed root/descendant/reference UUIDs; expected zero. Use the saved manifest after temporary tables are gone.
- [ ] Independently confirm protected PR1s and all three independent PR2 roots/graphs remain.
- [ ] Verify PR1, Planning PR2/raw-material, RFQ/buyer and supplier quotations, PO, delivery, GRN, approvals and notification views load correctly using authorized user access. Check list and relevant detail/navigation states, including stale-link handling and browser errors.
- [ ] Verify attachments on retained requests still resolve, and creating a legitimate next request does not fail from missing dependencies. Use a controlled test environment for actual creation; do not introduce new dummy production requests.
- [ ] Record known retained historical notification exceptions separately; do not call the cleanup "all notifications removed."
- [ ] Update batch status to COMMITTED_VERIFIED only after database and application checks pass. Otherwise mark COMMITTED_VERIFICATION_FAILED and stop; do not claim rollback is possible after commit.
- [ ] Append timestamps in UTC/PHT, batch/root UUID, expected and actual table counts, manifest/script hashes, transaction outcome, verification output and exceptions to the journal.
- [ ] Update this plan's queue after each completed batch, then proceed to its immediate successor only.

If authorized UI access is unavailable, record application verification incomplete and stop advancement. An SQL-only success is not evidence of a bug-free application.

## Task 6: Separate Storage Review

**Files:** Storage paths in audit report; later exact `(bucket,path,source_row_id)` manifest.

- [ ] Keep every Storage object during database cleanup. The ten candidate paths remain retained references for later review; deleted DB metadata will not remove the files.
- [ ] Resolve bucket mappings from source code/object metadata: PR1 `pr1-attachments`, Planning PR2 `pr2-item-attachments`, RFQ `rfq-attachments`, compliance `compliance-documents`. Resolve delivery document storage separately; do not guess its bucket or interpret every path as the same bucket.
- [ ] Verify object existence and every retained reference, including `supplier_documents.file_path`, `message_attachments.file_path`, other workflow paths and embedded URLs/JSON if applicable. A matching basename/path prefix is not enough.
- [ ] Hold shared or unproven paths. Any later Storage removal requires its own reviewed exact-object scope after application checks pass.
- [ ] Use the Storage API for a separately authorized object removal. Never DELETE from `storage.objects` through SQL, delete by a broad prefix, or assume database rollback reverses object removal.

Database completion and Storage completion are distinct statuses.

## Stop Conditions

Stop the current operation and do not start the next batch when:
- A root lacks business confirmation, or a held/client root appears in a mutation set.
- Root UUID/number, evidence, row identities, content, counts or schema/trigger metadata differ from the reviewed manifest.
- A target row is shared with, or references/is referenced by, an unowned or retained workflow row.
- Any supplemental record lacks exact structured ownership or its reviewed hash.
- Writes/external side effects cannot be controlled, or one-session execution cannot be guaranteed.
- A lock/statement timeout, SQL exception, affected-count mismatch, nonzero frozen remainder or protected-row change occurs.
- Transaction outcome is unknown, or post-commit database/application verification fails.
- The runner has only been parsed rather than behaviorally tested.

Unresolved text-only hints are preserved, not silently expanded into the deletion scope. Backup waiver is recorded as a recovery risk, not reversed into a new mandatory backup requirement.

## Acceptance Criteria

- Only confirmed roots and their frozen, exclusively owned rows were deleted.
- Every queued batch ran in order; every advancement followed database and application verification.
- Held/newer roots, independent raw-material PR2 graphs, other batches and shared data remained unchanged.
- No broken database/application references were introduced by the cleanup.
- Historical notification exceptions and retained Storage objects are reported honestly.
- Audit artifacts, execution journal and queue statuses agree with actual tool results.
