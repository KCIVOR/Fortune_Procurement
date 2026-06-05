# Phase 0 — Baseline Snapshot (Live DB)

**Project ref:** `emddvbocupvufzvhcacz`  
**Project name:** Fortune Procurement  
**Verified:** 2026-06-04  
**Method:** `npx supabase migration list --linked` + `npx supabase db query --linked`

---

## 0.1 Migrations

| Check | Result |
|-------|--------|
| Local migration files | **105** |
| Remote applied (CLI list) | **105** — all rows show Local = Remote |
| Pending push | **None** (fully in sync) |

**Conclusion:** Repo migrations match remote database.

---

## 0.2 Tables without RLS

| table_name | Notes |
|------------|--------|
| **rfq_suppliers** | **Only table** in `public` with `relrowsecurity = false` |

**F3 CONFIRMED:** Policies exist on `rfq_suppliers` but RLS is **disabled**, so policies are inactive.

---

## 0.4 `rfq_suppliers` detail

| Property | Value |
|----------|--------|
| `rls_enabled` | `false` |
| Policy count (defined) | **7** |

Policies present (inactive until RLS enabled):

| policyname | cmd |
|------------|-----|
| Procurement can select rfq_suppliers | SELECT |
| Procurement can insert rfq_suppliers | INSERT |
| Procurement can update rfq_suppliers | UPDATE |
| Suppliers can view own rfq_suppliers rows | SELECT |
| Suppliers can update own rfq_suppliers status | UPDATE |
| Requestors can view rfq_suppliers for their own PR1s | SELECT |
| Directors can view rfq_suppliers | SELECT |

---

## 0.3 Permissive policies (`qual` or `with_check` = `true`)

Matches audit expectations. **20 policy rows** on live DB:

| tablename | policyname | cmd | Issue |
|-----------|------------|-----|--------|
| approval_actions | Authenticated users can read approval actions | SELECT | Global read |
| approval_instances | Authenticated users can read approval instances | SELECT | Global read |
| approval_instances | Authenticated users can update approval instances | UPDATE | **Global write** |
| approval_steps | Authenticated users can read approval steps | SELECT | Config read (OK) |
| approval_workflows | Authenticated users can read approval workflows | SELECT | Config read (OK) |
| audit_logs | Authenticated users can read audit logs | SELECT | **F7** |
| audit_logs | Authenticated users can insert audit logs | INSERT | Open insert |
| bugtrack_settings | Everyone can view bugtrack settings | SELECT | Low risk |
| controlled_form_* | Authenticated users can read form * | SELECT | Config read (OK) |
| departments | Authenticated users can read departments | SELECT | Directory (OK) |
| notifications | Authenticated users can insert notifications | INSERT | **F12** |
| positions | Authenticated users can read positions | SELECT | Directory (OK) |
| pr1_items | Authenticated users can read all PR1 items | SELECT | **F1** |
| pr1_requests | Authenticated users can read all PR1s | SELECT | **F1** |
| pr1_requests | Procurement and approvers can update PR1 priority | UPDATE | `with_check: true` (scoped USING) |
| profiles | Authenticated users can read all profiles | SELECT | Directory |
| roles | Authenticated users can read roles | SELECT | Directory (OK) |
| warehouse_validation_items | Authenticated users can read validation items | SELECT | Global read |
| warehouse_validations | Authenticated users can read warehouse validations | SELECT | **F8 partial** |

**Note:** `warehouse_validations` INSERT policy uses `validator_id = auth.uid()` — not in this list because `with_check` is not literally `true`; still risky (any role can insert as self). Phase 1E addresses this.

---

## 0.5 Demo users (regression matrix)

Passwords: demo migrations (see `ROLLBACK_SUMMARY.md` / seed docs). Use for Phase 7 manual tests.

| Role | Email | User UUID | Position |
|------|-------|-----------|----------|
| admin | admin@fortune.com | `6a453ef1-ec44-409d-a0a5-836755368aa9` | System Administrator |
| approver | supervisor@fortune.com | `0321ca87-f360-4e9e-9f26-2568e623f28a` | Supervisor |
| approver | dept.head@fortune.com | `80ed9894-3f05-4ed7-a8a3-c6240c862745` | Department Head |
| approver | director@fortune.com | `c3ec21fb-4714-4b79-abeb-0e1c86924e0a` | Director |
| approver | finance.director@fortune.com | `acd04e60-cca6-4a47-9a75-8d95fe10868c` | Finance Director |
| employee | employee@fortune.com | `23d2af6f-15e8-4e71-8702-116ea3d4e361` | Staff |
| procurement | procurement@fortune.com | `302142f0-9055-4a9f-9dda-7c216a7f2f85` | Procurement Staff |
| procurement | buyer@fortune.com | `b28c7ead-a5a7-4030-9274-3f8789655251` | Buyer |
| procurement | proc.manager@fortune.com | `3c8d5ebd-e055-4349-af31-34cb1cf8fdeb` | Procurement Manager |
| supplier | supplier@fortune.com | `22caeaf8-82bb-4df7-84f7-d2456b0f47a1` | Supplier Representative |
| supplier | supplier2@fortune.com | `b2e10000-0000-0000-0000-000000000002` | Supplier Representative |
| supplier | supplier3@fortune.com | `b3e10000-0000-0000-0000-000000000003` | Supplier Representative |
| warehouse | warehouse@fortune.com | `34227d41-d26e-43de-9e78-dcbd1cbeec3e` | Warehouse Staff |
| warehouse | wh.manager@fortune.com | `11069aa8-f0b2-4827-8a67-fe6ec5253c79` | Warehouse Manager |
| tsqa | — | **No TSQA profile** on this DB | Create before TSQA route tests |

---

## 0.6 Policy inventory summary

- **Public tables:** 41  
- **Tables with ≥1 policy:** 40 (all except `rfq_suppliers` effectively unprotected)  
- **Highest policy counts:** `deliveries` (10), `supplier_products` (9), `po_requests` (8)

Full per-table counts recorded in implementation plan Appendix D.

---

## Phase 0 exit criteria

| Criterion | Status |
|-----------|--------|
| Written baseline snapshot stored | ✅ This file |
| F3 confirmed on live DB | ✅ `rfq_suppliers` RLS **off**, 7 policies dormant |
| Migrations in sync | ✅ 105/105 |
| Demo users documented | ✅ 14 users (no TSQA) |

**Ready for Phase 1A** (`ENABLE ROW LEVEL SECURITY` on `rfq_suppliers`).

---

## Re-run commands

```bash
cd c:\Users\Rovick\Desktop\project
npx supabase migration list --linked
npx supabase db query --linked -f scripts/phase0-baseline-verification.sql
```

(SQL file runs multiple statements — run individual queries if the CLI only executes one statement per invocation.)
