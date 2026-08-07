# Fortune Procurement System — Client Acceptance & Sign-Off

**Document purpose:** This document certifies that the client has reviewed and tested the system revisions listed below, and confirms that each is functioning as agreed. Signing this document constitutes formal acceptance of the completed revisions.

| Field | Detail |
|---|---|
| System | Fortune Procurement System |
| Document date | _____________________ |
| Prepared by | _____________________ |
| Reviewed by (Client) | _____________________ |

---

## 1. Revisions Covered by This Acceptance

The following revisions were requested by the client, implemented, and are presented here for acceptance. Each has been verified technically (type-checking, database policy checks, and application build) and is ready for the client's own functional testing prior to sign-off.

| # | Revision | Description | Status |
|---|----------|-------------|--------|
| 1 | VAT Handling | VAT-able/Non-VAT supplier flag, VAT-IN/VAT-EX quotation entry, and Subtotal/VAT/Total breakdown across PR2, PO, and print views | ☐ Accepted |
| 2 | PR Assignment to Buyer | Assign a Purchase Request to a specific procurement staff member, with notification and filtering | ☐ Accepted |
| 3 | Accreditation Expiry per Document | Manual expiry date entry on accreditation and product/service verification approvals, replacing the old global auto-calculation | ☐ Accepted |
| 4 | Substitute Accept/Reject by Procurement | Procurement can accept or reject substitute items on behalf of the requestor, with audit logging | ☐ Accepted |
| 5 | RFQ Reopen Once Closed | Closed RFQs can be reopened for supplier price updates, blocked once a PR2/PO already exists | ☐ Accepted |
| 6 | GRN Reopen and Edit Once Closed | Closed GRNs can be reopened, edited, and re-closed, with a visible trace of prior closure | ☐ Accepted |
| 7 | GRN for Services (Procurement-Handled) | Procurement handles GRN for service-type transactions; warehouse remains restricted to goods-type GRNs | ☐ Accepted |
| 8 | Priority Level — Visibility, Permission, Filtering | Priority field editable by requestor/approver/procurement, with column and filter added across all relevant list pages | ☐ Accepted |

---

## 2. Items Not Covered by This Acceptance

The following requested revisions are **not** included in this sign-off, as they remain in progress or pending scope confirmation:

| # | Revision | Status |
|---|----------|--------|
| 9 | TSQA / RSE Product Review Redesign | Blocked — requirements to be confirmed |
| 10 | Remarks on PR1 Request Creation | Not started |
| 11 | Supplier Product Registration by Procurement | Not started |
| 12 | Warehouse Change Request Quantity | Not started |

---

## 3. Client Confirmation

By signing below, the client confirms that:

1. The revisions listed in Section 1 have been tested in the live/staging environment by an authorized representative of the client.
2. Each revision performs as described and meets the client's requirements.
3. Any issues found during testing have been reported separately and are not blocking acceptance of the items marked "Accepted" above.
4. This sign-off does not cover the items listed in Section 2, which remain open for future delivery.

---

## 4. Signatures

**Client Representative**

Name: _____________________________

Position: _____________________________

Signature: _____________________________

Date: _____________________________

---

**Service Provider Representative**

Name: _____________________________

Position: _____________________________

Signature: _____________________________

Date: _____________________________
