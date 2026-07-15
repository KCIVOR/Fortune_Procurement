# Approval Workflow — Version History

Tracks how the client's approval workflow has changed across revisions, so we can show what changed and when. Each version below is the full flow as of that point; the **"Change from previous"** line calls out exactly what moved.

**Legend:** `(PR1)`, `(RFQ)`, `(PR2 PHASE 1)`, `(PR2 PHASE 2)`, `(PO)` are document/process stages. Names within a stage are the sequential approval chain for that stage.

---

## Version 1 — Baseline

| Stage | Approval Chain |
|---|---|
| **PR1** | Requestor → Warehouse → Supervisor → Dept. Head |
| **RFQ** | Procurement |
| **PR2 Phase 1** | Dept. Head → Procurement Staff → Procurement Manager → Director |
| **PR2 Phase 2** | Procurement Staff → Procurement Manager → Director |
| **PO** | Buyer → Procurement Manager → Finance Director |

---

## Version 2 — Dept. Head removed from PR2 Phase 1

| Stage | Approval Chain |
|---|---|
| **PR1** | Requestor → Warehouse → Supervisor → Dept. Head |
| **RFQ** | Procurement |
| **PR2 Phase 1** | ~~Dept. Head~~ → Procurement Staff → Procurement Manager → Director |
| **PR2 Phase 2** | Procurement Staff → Procurement Manager → Director |
| **PO** | Buyer → Procurement Manager → Finance Director |

**Change from V1:** Dept. Head no longer sits in the PR2 Phase 1 chain. PR2 Phase 1 now starts directly with Procurement Staff.

---

## Version 3 — PR2 Phase 2 removed

| Stage | Approval Chain |
|---|---|
| **PR1** | Requestor → Warehouse → Supervisor → Dept. Head |
| **RFQ** | Procurement |
| **PR2 Phase 1** | Procurement Staff → Procurement Manager → Director |
| ~~**PR2 Phase 2**~~ | *(removed)* |
| **PO** | Procurement Staff² → Procurement Manager → Finance Director |

² *From V3 onward, "Procurement Staff" in PO is the buyer who handled the RFQ/PR2 (same role "Buyer" referred to in V1–V2) — not a separate/different user.*

**Change from V2:** PR2 Phase 2 is eliminated entirely. PR2 Phase 1 now leads straight into PO.

---

## Version 4 — PR1 signatory order changed (approvals before Warehouse)

| Stage | Approval Chain |
|---|---|
| **PR1** | Requestor → Supervisor → Dept. Head → Warehouse |
| **RFQ** | Procurement |
| **PR2 Phase 1** | Procurement Staff → Procurement Manager → Director |
| **PO** | Procurement Staff → Procurement Manager → Finance Director |

**Change from V3:** Within PR1, Warehouse validation is moved to *after* Supervisor and Dept. Head sign off, instead of before. (Supervisor/Dept. Head now approve first; Warehouse validates last.)

---

## Version 5 — Warehouse moved first so planning can see stock upfront

| Stage | Approval Chain |
|---|---|
| **PR1** | Requestor → Warehouse → Supervisor → Dept. Head |
| **RFQ** | Procurement |
| **PR2 Phase 1** | Procurement Staff → Procurement Manager → Director |
| **PO** | Procurement Staff² → Procurement Manager → Finance Director³ |

**Change from V4:** Per planning's request, Warehouse moves back to immediately after the Requestor (ahead of Supervisor and Dept. Head), so stock availability is visible before the request goes further up the chain.

³ *In V5–V6, "Finance Director" in PO is the same Director who approved PR2 Phase 1 — not a separate/different user.*

---

## Version 6 — Engineering department variant discovered (two dept. heads, new ODM approver)

Distinct from the general flow above — this is the flow specific to the **Engineering department**, discovered to differ from the standard PR1 chain used elsewhere.

| Stage | Approval Chain |
|---|---|
| **PR1** | Requestor → Dept. Head → Dept. Head → Warehouse → ODM *(new approver)* |
| **RFQ** | Procurement |
| **PR2 Phase 1** | Procurement Staff → Procurement Manager → Director |
| **PO** | Procurement Staff² → Procurement Manager → Finance Director³ |

**Change from V5 (Engineering only):** PR1 order flips Dept. Head and Warehouse (Dept. Head now signs before Warehouse), requires **two Dept. Head approvals** in sequence (Engineering has two department heads), and adds a new approver, **ODM**, after Warehouse.

---

## Side-by-Side Summary

| Stage | V1 (Baseline) | V2 | V3 | V4 | V5 | V6 (Current — Engineering variant) |
|---|---|---|---|---|---|---|
| **PR1** | Requestor → Warehouse → Supervisor → Dept. Head | *(same)* | *(same)* | Requestor → Supervisor → Dept. Head → **Warehouse** | Requestor → **Warehouse** → Supervisor → Dept. Head | Requestor → Dept. Head → **Dept. Head** → Warehouse → **ODM** *(new)* |
| **RFQ** | Procurement | *(same)* | *(same)* | *(same)* | *(same)* | *(same)* |
| **PR2 Phase 1** | Dept. Head → Proc. Staff → Proc. Manager → Director | **Dept. Head removed** | *(same as V2)* | *(same)* | *(same)* | *(same)* |
| **PR2 Phase 2** | Proc. Staff → Proc. Manager → Director | *(same)* | **Removed** | *(remains removed)* | *(remains removed)* | *(remains removed)* |
| **PO** | Buyer → Proc. Manager → Finance Director | *(same, "Buyer")* | Renamed to **Proc. Staff²** *(same person)* | *(same)* | *(same, "Finance Director" = the Director³)* | *(same)* |

## Change Log

1. **V1 → V2:** Removed Dept. Head from the PR2 Phase 1 approval chain.
2. **V2 → V3:** Removed the entire PR2 Phase 2 stage.
3. **V3 → V4:** Reordered PR1 signatories — Warehouse validation moved from first to last (now after Supervisor and Dept. Head).
4. **V4 → V5:** Reordered PR1 again — Warehouse moved back to immediately after Requestor (ahead of Supervisor and Dept. Head) so planning can see stock first.
5. **V5 → V6:** Engineering-specific variant discovered — PR1 flips Dept. Head/Warehouse order, requires two Dept. Head approvals in sequence, and adds a new ODM approver after Warehouse. Applies to Engineering only; other departments presumed to follow V5.
