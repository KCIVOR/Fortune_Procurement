# Accreditation + Documents + Expiry — Surgical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan **only after Phase 0 decisions are locked**. Steps use checkbox (`- [ ]`) syntax for tracking.

## Plain English first

**Today (what the system actually does):**
- Expiry lives on the **whole accreditation application** (`valid_until` + status `expired`).
- Uploaded **files** are just files. The app never marks them verified/expired, even though the DB columns exist.

**This plan’s job:**
1. You pick **one direction** (A, B, or C) — see below.
2. We re-check the live DB (Phase 1).
3. We change **only the files listed** for that path.
4. We test before calling it done.

**Direction locked: B — Per document** (user confirmed 2026-07-15).

| Choice | In plain words | Status |
|--------|----------------|--------|
| **A — Fix bugs only** | Keep expiry on the application; fix UI gaps only. | N/A |
| **B — Per document** | Expiry on each uploaded file; stop writing application `valid_until` on approve. | **LOCKED** |
| **C — Both** | Application + document expiry together. | N/A |

**Companion locks (recommended defaults accepted with B):** see Decision Log below.

**Other notes:**
- Detailed Path B task sketch: `2026-07-15-document-level-accreditation-verification.md` (use after Phase 1; this file remains the tracker).
- Past docs disagreed on per-doc vs account; **B settles that.**

**Tech stack:** Next.js App Router, Supabase (Postgres + `pg_cron` + RLS), `lib/accreditation.ts` / `lib/accreditation-documents.ts`.

**Evidence:** Audit of migrations + app code only. Live counts must be re-checked in Phase 1 (do not trust old snapshots).

---

## How to use this plan (short)

1. ~~**Phase 0** — Answer A / B / C.~~ **Done (B).**
2. ~~**Phase 1** — Run the SQL checks; paste results.~~ **Done (2026-07-15).**
3. Do **Path B** phases only (B1–B6), then V.
4. Don’t edit files outside Path B’s list.
5. Tick checkboxes as you go.

---

## Part 0 — Frozen evidence (from audit; do not re-invent)

### E1. `supplier_accreditations` (account)

| Fact | Evidence |
|------|----------|
| Has nullable `valid_until` | Migration `20260624020501_expiry_system_schema.sql` |
| Status CHECK includes `expired` | Same + earlier status migrations |
| Nightly cron (latest) auto-expires **approved** rows by `valid_until` | `20260714180000_stop_product_expiry_cron.sql` |
| Cron does **not** clear `valid_until` | Same SQL |
| Manual revoke → `expired` + clears `valid_until` | `lib/accreditation.ts` `revokeAccreditation` |
| Approve may set optional `valid_until` | `approveAccreditation` + `app/accreditation/[id]/page.tsx` |
| FKs from products/docs/RSE are on **id only** (not status) | Audit A7 |

### E2. `supplier_documents` (shared)

| Fact | Evidence |
|------|----------|
| Columns `status`, `expires_at` exist | `20260507000200_supplier_accreditation_schema.sql` |
| CHECK: `uploaded` \| `accepted` \| `rejected` \| `expired` | Same |
| App writes **only** `status='uploaded'`, `expires_at=null` on insert | `lib/accreditation-documents.ts` |
| No app code updates document status after insert | Audit D |
| No document-expiry cron | Audit A3–A4 |
| Procurement/admin have blanket UPDATE RLS; supplier has no UPDATE | Audit A5 |
| Same table/CHECK for accreditation docs, product docs, RSE reports | Differentiated by FK / `document_type` |

### E3. Consumers that read accreditation **status** (not docs)

| Consumer | Behavior (evidence) |
|----------|---------------------|
| `lib/canvassing.ts` | Latest accreditation status string only |
| `AssignSuppliersModal` / RFQ filters | `approved` = accredited; no dedicated `expired` |
| `lib/procurement-suppliers.ts` | `expired` mapped to `'none'` |
| Compliance / dashboards | Display or count statuses; docs unused for readiness |

### E4. Known gaps already in production code (not speculative)

| Gap | Evidence |
|-----|----------|
| Supplier portal maps omit `expired`; no “start new” after expired | Audit B7 |
| Procurement supplier accounts treat `expired` as `'none'` | `toAccreditationStatus` |
| Revoke clears `valid_until` → detail often shows expired with no date | Audit B7 |
| Document CHECK values `accepted`/`rejected`/`expired` unused by app | Audit C / D |

### E5. Surgical constraints (always apply)

1. Do not rename `supplier_documents` CHECK unless Phase 0 explicitly chooses rename (affects product + RSE).
2. Do not change product verification expiry (`lib/supplier-products.ts`, product pages) unless Phase 0 expands scope.
3. Do not change RFQ/canvassing readiness rules unless Phase 0 expands scope.
4. Do not DROP `supplier_accreditations.valid_until` or remove accreditation `expired` from CHECK in v1 unless Phase 0 explicitly allows (harder rollback).
5. Prefer filter `accreditation_id IS NOT NULL AND supplier_product_id IS NULL` for any document verify/expiry work so product/RSE rows are untouched.

---

## Phase 0 — Decisions

> **Status: LOCKED for Path B** (2026-07-15).

### D1 in one sentence each

- ~~**A** = Keep one expiry date on the application.~~ N/A
- **B** = Put expiry on **each document**. Stop using application `valid_until` for new work. ← **chosen**
- ~~**C** = Do both.~~ N/A

### Decision Log

| ID | Question (plain English) | Options | Answer | Who | Date |
|----|--------------------------|---------|--------|-----|------|
| D1 | Where should expiry live? | **A** · **B** · **C** | **B — documents** | User | 2026-07-15 |
| D2 | Keep DB values `uploaded`/`accepted` or rename? | **Keep** · **Rename** | **Keep** (UI: Pending / Verified / Rejected / Expired) | Recommended default w/ B | 2026-07-15 |
| D3 | Block Approve until every doc is verified? | **Yes** · **No** | **No** (approve finishes review; docs verified separately) | Recommended default w/ B | 2026-07-15 |
| D4 | Change RFQ/canvassing “is accredited?” rules? | **No** · **Yes** | **No** (still application `approved`) | Recommended default w/ B | 2026-07-15 |
| D5 | Nightly job should expire… | Applications · Documents · Off | **Documents** (accreditation-linked docs only) | Recommended default w/ B | 2026-07-15 |
| D6 | Old application `valid_until` values? | Leave · Clear · Stop writing | **Clear to null once** + **stop writing** new values; keep column | Recommended default w/ B | 2026-07-15 |
| D7 | Keep manual “Revoke → expired” on the application? | Keep · Remove · Change | **Keep** (emergency close; cron no longer drives it) | Recommended default w/ B | 2026-07-15 |
| D8 | After application is expired, can supplier start a new one? | Yes · No | **Yes** (fix UI) | Recommended default w/ B | 2026-07-15 |
| D9 | Show “Expired” correctly on procurement supplier list? | Yes · No | **Yes** (fix mapping) | Recommended default w/ B | 2026-07-15 |
| D10 | Also do product/RSE documents in this same project? | No · Yes | **No** | Recommended default w/ B | 2026-07-15 |
| D11 | Emails / PDF auto-read dates? | Later · Now | **Later** | Recommended default w/ B | 2026-07-15 |

### Which phases run

| You chose | Then do |
|-----------|---------|
| **B** | Phase 1 → **B1–B6** → final checks (V) |
| A / C | **N/A** |

- [x] **0.1** Answer D1–D11.
- [x] **0.2** Path A and Path C marked N/A.
- [x] **0.3** N/A (not C).
- [x] **0.4** D4/D10/D11 keep scope narrow.

**Done with Phase 0.** Next: Phase 1 baseline SQL.

---

## Phase 1 — Baseline verification (read-only)

> **Purpose:** Re-confirm audit claims against **this** environment before changing anything. Never assume live data matches a prior snapshot.

### 1.1 SQL baseline (run and paste results into notes)

```sql
-- Accreditation status distribution
SELECT status, count(*) FROM public.supplier_accreditations GROUP BY status ORDER BY 1;

-- Account expiry column usage
SELECT count(*) FILTER (WHERE valid_until IS NOT NULL) AS with_valid_until,
       count(*) FILTER (WHERE status = 'expired') AS status_expired
FROM public.supplier_accreditations;

-- Document status / expiry usage
SELECT status, count(*) FROM public.supplier_documents GROUP BY status ORDER BY 1;
SELECT count(*) FILTER (WHERE expires_at IS NOT NULL) AS with_expires_at
FROM public.supplier_documents;

-- Shared-table split
SELECT
  count(*) FILTER (WHERE accreditation_id IS NOT NULL AND supplier_product_id IS NULL) AS acc_docs,
  count(*) FILTER (WHERE supplier_product_id IS NOT NULL) AS product_linked_docs,
  count(*) FILTER (WHERE document_type = 'rse_report') AS rse_reports
FROM public.supplier_documents;

-- Live cron body
SELECT jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'expire-accreditations-and-products';
```

- [x] **Step 1.1:** Run SQL; record counts in “Baseline notes” below.
- [x] **Step 1.2:** Confirm cron command still matches audit A4 (account UPDATE) or note drift.
- [x] **Step 1.3:** Grep confirm no app writers of document status beyond insert:

```bash
rg -n "expires_at|status:\\s*'accepted'|status:\\s*'expired'" lib/accreditation-documents.ts app/accreditation app/supplier/accreditation
```

Result: `lib/accreditation-documents.ts` only writes `expires_at: null` on insert (3 upload paths). No `accepted`/`expired` status writes in accreditation UI paths.

- [x] **Step 1.4:** Confirm `system_expiry_settings` absent (`to_regclass('public.system_expiry_settings')` → null).

### Baseline notes (filled 2026-07-15 — live Supabase SELECT only)

| Check | Result | Date |
|-------|--------|------|
| Acc status counts | approved **4**, rejected **2**, under_review **1**, withdrawn **1** (total 8). **expired 0** | 2026-07-15 |
| Acc with `valid_until` | **3** rows have `valid_until`; **0** with status `expired` | 2026-07-15 |
| Doc status counts | **uploaded: 19** only (no accepted/rejected/expired rows) | 2026-07-15 |
| Docs with `expires_at` | **0** | 2026-07-15 |
| Doc link split | acc_docs **16**, product_linked **3**, rse_reports **1** | 2026-07-15 |
| Cron command summary | Job `expire-accreditations-and-products`, `0 0 * * *`, **active**. UPDATEs `supplier_accreditations` → `expired` where approved + `valid_until < CURRENT_DATE`. Does **not** touch documents. | 2026-07-15 |
| `system_expiry_settings` | **null** (table absent) | 2026-07-15 |
| Drift vs audit? | **No material drift.** Counts match prior audit snapshot. Cron still account-level (audit A4). Safe for Path B: no non-`uploaded` docs to migrate; clearing 3× `valid_until` is the only account data touch in B1. | 2026-07-15 |

**Phase 1 exit criteria:** Baseline notes filled; any drift called out; Path from Phase 0 still valid. ✅ **Met — Path B remains valid.**

---

## Path A — Gap fixes only — **N/A (D1 = B)**

> Skipped. Kept below for history only; do not implement.

### File allowlist (Path A)

| File | Allowed change |
|------|----------------|
| `app/supplier/accreditation/page.tsx` | Only if D8=Yes: expired chip/copy + start-new after expired |
| `lib/procurement-suppliers.ts` | Only if D9=Yes: include `expired` in union + mapping |
| `components/procurement/SupplierAccountsTable.tsx` | Labels if D9=Yes |
| `components/procurement/SupplierAccountDetail.tsx` | Labels if D9=Yes |
| `components/procurement/PickRawMatSupplierModal.tsx` | Labels/filters if D9=Yes |
| `components/canvassing/AssignSuppliersModal.tsx` | Expired label only if explicitly requested; **no readiness rule change** unless D4=Change |
| `lib/accreditation.ts` | Only if fixing revoke/`valid_until` inconsistency **and** D7 requires it |
| `app/accreditation/[id]/page.tsx` | Only banner/copy consistency for revoke vs cron dates if in scope |

**Do not touch (Path A):** document CHECK, document cron, `lib/accreditation-documents.ts` verify helpers, product expiry module.

### Phase A1 — Supplier portal expired UX (if D8=Yes)

- [ ] **A1.1:** Add `expired` to supplier status chip/description maps (mirror queue labels; do not invent new statuses).
- [ ] **A1.2:** Extend `canStartNewAfterClose` (or equivalent) to include `expired` **only if** `createDraftAccreditation` already allows it (audit B1: blocks draft/submitted/under_review/missing_documents/approved — not expired).
- [ ] **A1.3:** Manual check: supplier with `expired` application can start new draft; withdrawn/rejected still work.
- [ ] **A1.4:** Commit: `fix: allow supplier restart after expired accreditation`

### Phase A2 — Procurement mapping (if D9=Yes)

- [ ] **A2.1:** Extend `SupplierAccreditationStatus` + `toAccreditationStatus` so `expired` is not `'none'`.
- [ ] **A2.2:** Update `ACCRED_LABELS` in the three procurement components listed above.
- [ ] **A2.3:** Typecheck: `npx tsc --noEmit`
- [ ] **A2.4:** Commit: `fix: map expired accreditation status in procurement supplier UI`

### Phase A3 — Revoke vs cron `valid_until` consistency (only if D7 requires)

- [ ] **A3.1:** Choose one evidenced behavior and document it in Decision Log notes:
  - Option 1: Revoke keeps `valid_until` (align with cron).
  - Option 2: Cron clears `valid_until` when expiring (align with revoke).
  - Option 3: UI stops requiring a date when `valid_until` is null.
- [ ] **A3.2:** Implement **only** the chosen option in allowlisted files.
- [ ] **A3.3:** Verify revoke + (if D5 keeps cron) one SQL dry-run of cron body on a staging row.
- [ ] **A3.4:** Commit with message matching the chosen option.

**Path A exit → Phase V.**

---

## Path B — Document-level verification + expiry — **ENABLED (D1 = B)**

> Locked. Preconditions from Decision Log (all set):
> - D2 answered (default recommendation: **Keep** DB enum; UI labels only).
> - D3 answered (blocks or does not block Approve).
> - D4 = Unchanged recommended for surgical v1.
> - D5 = Replace with document-only UPDATE (typical for Path B).
> - D6 = Clear `valid_until` once + stop writing; keep column.
> - D10 = No (product/RSE out of scope).
> - D11 = Out of scope.

### File allowlist (Path B)

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_document_expiry_cron.sql` | New — cron + index; clear account `valid_until` |
| `lib/accreditation-documents.ts` | Add verify / reject / update-expiry helpers; keep upload insert as `uploaded` |
| `lib/accreditation.ts` | Stop writing account `valid_until` on approve (per D6); keep or hide revoke per D7 |
| `app/accreditation/[id]/page.tsx` | Per-doc actions; remove account expiry inputs if stopping account expiry |
| `app/accreditation/page.tsx` | Remove Valid Until column reliance; Expired tab = application `expired` only unless later scoped |
| `app/supplier/accreditation/page.tsx` | Read-only doc status + `expires_at`; D8 if Yes |
| `lib/procurement-suppliers.ts` + procurement label components | Only if D9=Yes |
| `types/database.ts` | Only if types diverge from live CHECK (audit: already match) |

**Do not touch (Path B v1):** `lib/canvassing.ts`, RFQ readiness, `lib/supplier-products.ts`, product accreditation pages, RSE verify flows, document CHECK rename (unless D2=Rename).

### Vocabulary (only if D2 = Keep)

| UI label | DB value |
|----------|----------|
| Pending | `uploaded` |
| Verified | `accepted` |
| Rejected | `rejected` |
| Expired | `expired` |

### Phase B1 — Migration: document cron; stop account auto-expiry

**Depends on:** D5 = Replace (or Unschedule). If D5 = Keep, **skip B1** and stop — Path B contradicts keeping account cron; return to Phase 0.

- [x] **B1.1:** Create migration…
- [x] **B1.2:** Apply migration via project’s normal Supabase workflow.
- [x] **B1.3:** Verify… (cron → documents; valid_until count 0; index present)
- [ ] **B1.4:** Commit migration only. *(deferred — commit when you ask)*

### Phase B2 — Library: document verify / reject / edit expiry

- [ ] **B2.1:** In `lib/accreditation-documents.ts`, add helpers that:
  - Assert row is accreditation application doc (`accreditation_id` set, `supplier_product_id` null).
  - `verify`: `uploaded`|`accepted` → `accepted` + required future `expires_at`.
  - `reject`: `uploaded`|`accepted` → `rejected`, `expires_at = null`.
  - `updateExpiry`: `accepted` only; future `expires_at`.
  - Write audit actions:
    - Verify → `ACCREDITATION_DOCUMENT_VERIFIED`
    - Reject → `ACCREDITATION_DOCUMENT_REJECTED`
    - Edit expiry → `ACCREDITATION_DOCUMENT_EXPIRY_UPDATED`
  - Do **not** change upload insert defaults.

- [ ] **B2.2:** Role checks in helpers must match existing accreditation patterns (procurement/admin); do not invent new roles.
- [ ] **B2.3:** `npx tsc --noEmit`
- [ ] **B2.4:** Commit.

### Phase B3 — Approve no longer writes account `valid_until`

- [ ] **B3.1:** Change `approveAccreditation` to always set `valid_until: null` (or omit update of that column only if confirmed equivalent — prefer explicit null if D6 stop-writing).
- [ ] **B3.2:** D3=No → do **not** block Approve on document statuses. (Skipped.)
- [ ] **B3.3:** Leave `updateAccreditationExpiry` / `revokeAccreditation` in lib until UI stops importing them (avoid mid-diff break).
- [ ] **B3.4:** Typecheck + commit.

### Phase B4 — Procurement detail UI

- [ ] **B4.1:** Remove account expiry date input from Approve panel; remove Edit Expiry action that calls `updateAccreditationExpiry`.
- [ ] **B4.2:** Document rows: show status label + `expires_at`; allow verify/reject/edit expiry when application status is `submitted` | `under_review` | `missing_documents` | `approved`. No edits when `withdrawn` | `rejected` | `expired` | `draft`.
- [ ] **B4.3:** Keep approve/reject/under review/missing docs/reopen; revoke per D7 (Keep).
- [ ] **B4.4:** Manual UI checklist (must all pass):
  - [ ] Verify doc → `accepted` + expiry shown
  - [ ] Reject doc → `rejected`, expiry cleared
  - [ ] Approve application → `approved`, `valid_until` null
  - [ ] Signed URL View still works
  - [ ] Product/RSE pages unchanged
- [ ] **B4.5:** Commit.

### Phase B5 — Queue UI

- [ ] **B5.1:** Remove Valid Until column that reads `row.valid_until`.
- [ ] **B5.2:** Expired tab: keep filtering application `status === 'expired'` for historical/manual revoke rows; do not imply account cron still drives it.
- [ ] **B5.3:** Commit.

### Phase B6 — Supplier portal read-only doc status (+ D8/D9 extras)

- [ ] **B6.1:** Show Pending/Verified/Rejected/Expired + expiry date; no supplier writes to status/expiry.
- [ ] **B6.2:** If D8=Yes: start-new after expired (same as A1).
- [ ] **B6.3:** If D9=Yes: procurement mapping (same as A2).
- [ ] **B6.4:** Commit.

**Path B exit → Phase V.**

---

## Path C — Hybrid — **N/A (D1 = B)**

> Skipped. Do not implement.

- [ ] ~~**C0.1:** Write explicit rules…~~ N/A
  - What Approve means vs document Verified.
  - Which cron runs (account, document, both).
  - What canvassing uses (D4).
  - What happens when docs expire but application stays `approved`.
- [ ] **C0.2:** Split into new surgical phases with their own allowlists.
- [ ] **C0.3:** Only then implement.

---

## Phase V — Verification gate (all paths)

### V1. SQL regression

```sql
-- Cron matches locked D5
SELECT command FROM cron.job WHERE jobname = 'expire-accreditations-and-products';

-- Document status distribution (accreditation docs only)
SELECT status, count(*) FROM public.supplier_documents
WHERE accreditation_id IS NOT NULL AND supplier_product_id IS NULL
GROUP BY status;

-- Product / RSE docs not accidentally bulk-updated
SELECT status, document_type, count(*) FROM public.supplier_documents
WHERE supplier_product_id IS NOT NULL OR document_type = 'rse_report'
GROUP BY status, document_type;
```

- [ ] **V1:** Run and record results.

### V2. Workflow regression matrix

| Case | Expected (fill from locked decisions) | Pass? |
|------|----------------------------------------|-------|
| Supplier draft → upload → submit | Unchanged | [ ] |
| Procurement under review / missing docs / reject | Unchanged | [ ] |
| Procurement approve | Per D1/D3/D6 | [ ] |
| Document verify/reject (Path B only) | Per B2 | [ ] |
| RFQ assign readiness | Per D4 | [ ] |
| Product verification pages | Unchanged unless D10=Yes | [ ] |
| Manual revoke | Per D7 | [ ] |
| Cron simulation (set past date; run UPDATE body once) | Per D5 | [ ] |

- [ ] **V2:** Complete matrix.
- [ ] **V3:** `npx tsc --noEmit` clean for touched files’ errors.
- [ ] **V4:** Update `docs/revision-progress.md` **only if** user requests progress sync (do not invent “done” status).

**Phase V exit criteria:** All enabled cases Pass; no unexplained drift in product/RSE document statuses.

---

## Rollback (path-specific)

### Path A
- Revert app commits for A1–A3. No cron/schema change expected.

### Path B
1. Re-schedule cron SQL from `20260714180000_stop_product_expiry_cron.sql` (account UPDATE).
2. Revert app commits B2–B6.
3. Column `valid_until` still present — can re-enable account expiry UI.
4. Document rows left as `accepted`/`rejected`/`expired` remain CHECK-valid; no status enum rollback required if D2=Keep.

### Path C
- Define rollback alongside C0 rules before coding.

---

## Issue avoidance checklist (read before every phase)

- [ ] Am I about to change `supplier_documents` CHECK? → Stop unless D2=Rename and product/RSE impact listed.
- [ ] Am I filtering document updates without `accreditation_id` / `supplier_product_id` guards? → Stop.
- [ ] Am I changing canvassing/RFQ readiness? → Stop unless D4=Change + separate tasks.
- [ ] Am I touching product `valid_until`? → Stop unless D10=Yes.
- [ ] Am I dropping `valid_until` or removing accreditation `expired`? → Stop unless Phase 0 explicitly allows.
- [ ] Am I assuming live row counts from an old snapshot? → Re-run Phase 1 SQL.
- [ ] Am I copying “Decisions locked” from the other draft plan without Phase 0 answers here? → Stop.

---

## Progress tracker

| Phase | Status | Owner | Notes |
|-------|--------|-------|-------|
| 0 Decision locks | **Done** | User + agent | Path **B** locked 2026-07-15 |
| 1 Baseline verify | **Done** | Agent | Live SELECT 2026-07-15; Path B still valid |
| A1 / A2 / A3 | **N/A** | | |
| B1–B6 | **Done** | Agent | Implemented on `feat/accreditation-document-expiry` |
| C0 | **N/A** | | |
| V Verification | **Done** (code+SQL) | Agent | `tsc` clean; cron simulated+restored; UI walkthrough still manual |

---

## Spec coverage (after Phase 0)

| Audit section | How this plan uses it |
|---------------|------------------------|
| A Database | Phase 1 re-verify; B1/A3 cron/schema rules |
| B App paths | File allowlists only from B1–B7 |
| C Vocabulary mismatch | D2 + UI label table |
| D Risk inventory | E5 + issue avoidance checklist |
| E File checklist | Path A/B allowlists subset of audit “Must change / Likely touch” |

**Placeholder scan:** Phase 0 blanks filled. Path B ready after Phase 1.

**Self-review rule:** If an implementer finds themselves inventing a product rule not in the Decision Log, stop and update Phase 0 first.
