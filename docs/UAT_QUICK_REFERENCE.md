# UAT Quick Reference Guide
## Fortune Procurement System

---

## Role Assignment Quick Reference

| Role | Position | Test Scenarios | Primary Modules |
|------|----------|----------------|-----------------|
| **Employee** | Staff | E-01 to E-89 | PR1, Dashboard, Notifications, Messages, Bug Tracking |
| **Warehouse** | Warehouse Staff | W-01 to W-67 | Warehouse Validation, GRN, Delivery |
| **Procurement** | Procurement Staff | P1-01 to P1-50 | RFQ, PR2 Phase 1 |
| **Procurement** | Buyer | P2-01 to P2-36 | PO, PR2 Phase 2 |
| **Procurement** | Procurement Manager | P3-01 to P3-32 | Approvals (PR2, PO), Oversight |
| **Approver** | Supervisor | A1-01 to A1-16 | PR1 Approval (Step 1) |
| **Approver** | Department Head | A2-01 to A2-24 | PR1 Approval (Step 2), PR2 Phase 1 (Step 2) |
| **Approver** | Director | A3-01 to A3-23 | PR2 Approvals (Final) |
| **Approver** | Finance Director | A4-01 to A4-18 | PO Approval (Step 3) |
| **Supplier** | Supplier Representative | S-01 to S-111 | Accreditation, Products, RFQ, PO, Delivery |
| **TSQA** | TSQA Staff | T-01 to T-50 | RSE, Product Approval |
| **Admin** | System Administrator | AD-01 to AD-143 | User Mgmt, Master Data, Workflows, Audit |

---

## Complete Procurement Workflow

```
┌─────────────┐
│  EMPLOYEE   │ Creates PR1
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  WAREHOUSE  │ Validates SOH → Insufficient
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SUPERVISOR  │ Reviews & Notes (Step 1)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ DEPT HEAD   │ Approves PR1 (Step 2 - FINAL)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│PROCUREMENT  │ Creates RFQ → Sends to Suppliers
│   STAFF     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  SUPPLIER   │ Submits Quotation
└──────┬──────┘
       │
       ▼
┌─────────────┐
│PROCUREMENT  │ Selects Winner → Generates PR2
│   STAFF     │ Signs PR2 Phase 1 (Step 1)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ DEPT HEAD   │ Certifies PR2 Phase 1 (Step 2)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│PROCUREMENT  │ Reviews PR2 Phase 1 (Step 3)
│  MANAGER    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  DIRECTOR   │ Approves PR2 Phase 1 (Step 4 - FINAL)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   BUYER     │ Signs PR2 Phase 2 (Step 1)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│PROCUREMENT  │ Reviews PR2 Phase 2 (Step 2)
│  MANAGER    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  DIRECTOR   │ Approves PR2 Phase 2 (Step 3 - FINAL)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   BUYER     │ Creates PO → Signs (Step 1)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│PROCUREMENT  │ Reviews PO (Step 2)
│  MANAGER    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  FINANCE    │ Approves PO (Step 3)
│  DIRECTOR   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  SUPPLIER   │ Acknowledges PO (Step 4 - FINAL)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  SUPPLIER   │ Updates Delivery Status
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  WAREHOUSE  │ Creates & Closes GRN
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  EMPLOYEE   │ Views Completed Delivery
└─────────────┘
```

---

## Status Transitions Quick Reference

### PR1
```
draft → pending_warehouse → pending_approval → approved
                          ↓
                    resolved_internal
                          ↓
                      rejected
```

### PR2
```
draft → pending_phase1_approval → phase1_approved → 
pending_phase2_approval → phase2_approved
```

### PO
```
draft → for_approval → approved → sent
```

### Delivery
```
pending → scheduled → in_transit → delivered
                   ↓
                delayed
```

### GRN
```
open → closed
```

---

## Test Credentials Template

| Role | Position | Email | Password | Department |
|------|----------|-------|----------|------------|
| employee | Staff | emp1@test.com | Test123! | Operations |
| warehouse | Warehouse Staff | wh1@test.com | Test123! | Warehouse |
| procurement | Procurement Staff | proc1@test.com | Test123! | Procurement |
| procurement | Buyer | buyer1@test.com | Test123! | Procurement |
| procurement | Procurement Manager | procm1@test.com | Test123! | Procurement |
| approver | Supervisor | super1@test.com | Test123! | Operations |
| approver | Department Head | dh1@test.com | Test123! | Operations |
| approver | Director | dir1@test.com | Test123! | Executive Office |
| approver | Finance Director | fin1@test.com | Test123! | Finance |
| supplier | Supplier Representative | sup1@test.com | Test123! | N/A |
| tsqa | TSQA Staff | tsqa1@test.com | Test123! | TSQA |
| admin | System Administrator | admin1@test.com | Test123! | IT |

---

## Common Test Data

### Sample PR1 Items
```
Item 1: ITM-001, Laptop Computer, 2 Units
Item 2: ITM-002, Office Chair, 5 Units
Item 3: ITM-003, Printer Paper, 10 Reams
Item 4: ITM-004, Ballpen (Blue), 20 Boxes
Item 5: ITM-005, Whiteboard Marker, 3 Sets
```

### Sample Suppliers
```
Supplier A: ABC Trading Corp. (sup1@test.com)
Supplier B: XYZ Supplies Inc. (sup2@test.com)
Supplier C: Global Office Solutions (sup3@test.com)
```

---

## Testing Checklist

### Before Starting UAT
- [ ] All test user accounts created
- [ ] Test data loaded (departments, positions, roles)
- [ ] Sample items added to system
- [ ] Supplier accounts registered
- [ ] Test environment is clean (no old data)
- [ ] All testers have access credentials
- [ ] UAT document distributed to all testers

### During UAT
- [ ] Each tester completes their role scenarios
- [ ] All Pass/Fail statuses marked
- [ ] Issues documented with screenshots
- [ ] Cross-role scenarios executed
- [ ] Daily status meetings held
- [ ] Issue tracker updated

### After UAT
- [ ] All critical issues resolved
- [ ] Failed scenarios retested
- [ ] Final sign-off obtained
- [ ] UAT report generated
- [ ] Lessons learned documented

---

## Issue Severity Guidelines

| Severity | Description | Example |
|----------|-------------|---------|
| **Critical** | System crash, data loss, security breach | Cannot login, data deleted |
| **High** | Major feature broken, workflow blocked | Cannot submit PR1, approval fails |
| **Medium** | Feature partially working, workaround exists | Filter not working, can search instead |
| **Low** | Minor UI issue, cosmetic problem | Button misaligned, typo in label |

---

## Quick Links

- **Full UAT Document:** `UAT_Role_Position_Based.md`
- **Audit Summary:** `UAT_AUDIT_SUMMARY.md`
- **This Guide:** `UAT_QUICK_REFERENCE.md`

---

## Contact Information

**UAT Coordinator:** _________________  
**Email:** _________________  
**Phone:** _________________  

**Technical Support:** _________________  
**Email:** _________________  
**Phone:** _________________  

---

**Last Updated:** May 22, 2026  
**Version:** 2.0

