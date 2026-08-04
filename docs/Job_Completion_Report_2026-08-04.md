# **Fortune Procurement System — Job Completion Report**

## **1. Job Information**

**Name:** Rovick
**Role:** Not specified — needs input
**Project:** Fortune Procurement System (web-based procurement management platform)
**Job Period:** 2026-05-05 – 2026-08-03 (based on the development history available at the time of this report)
**Report Date:** 2026-08-04

**Main Job Goal:**
Build a complete procurement management system covering the full request-to-receiving cycle — Purchase Request, Purchasing Request/Certification, Supplier Quotation, Purchase Order, Delivery, and Goods Receipt — for Goods, Raw Materials, and Services requests, matching the workflow standard approved by the client.

## **2. Overall Job Status**

**Overall Completion:** ~99% — Draft

**Current Status:**

☒ Completed
☐ Partially Completed
☐ Delayed
☐ Not Completed

**System Readiness:**

☒ Ready for full use
☐ Ready for testing with incomplete items
☐ Requires major additional development
☐ Not ready

### **Summary of Work Completed**

All four workflows the client approved — Goods, Raw Materials, Services, and Substitute Item Review — are fully built and confirmed working. This was checked two ways: by reviewing how the system is built, and separately by examining the system's own records directly, which show real requests that completed the entire process from initial request through to final receiving, for every request type. Quality-inspection requirements on Raw Materials were also confirmed to be enforced correctly — flagged items were routed for inspection and cleared as intended, not just described in the design. The Substitute Item Review feature, including its most recent extension to cover materials requests, is likewise confirmed working with real decisions on file, not only recently delivered.

### **Summary of Work Still Incomplete**

The system has been confirmed working correctly through direct inspection of its own records. The one remaining item is administrative rather than technical: there is no record of a formal walkthrough session conducted together with the client — that sign-off step has not yet taken place.

## **3. Job Deliverables Status**

| Module or Workflow | Status | Completion % | Details |
| ----- | ----- | ----- | ----- |
| Goods Requisition Workflow (Request → Certification → Quotation → Purchase Order → Delivery → Receiving) | Completed | 100% | The full process is built and functioning. Confirmed against real records: every certified request in the system has an approved quotation stage, purchase orders have been issued to suppliers, and multiple requests have been fully received and closed — a complete cycle, start to finish, verified on real data. |
| Raw Materials Requisition Workflow | Completed | 100% | The direct-entry process for Planning to raise raw-material requests (bypassing the standard request stage, per the approved design) is built and functioning, including supplier quotation, purchase ordering, delivery, and mandatory quality inspection at receiving. Confirmed against real records: certified requests carried all the way through to closed, quality-cleared receiving. |
| Services Requisition Workflow | Completed | 100% | Both entry points work as specified: an employee can raise a request that is later certified, or Planning can raise the certification directly. Importantly, the request is now certified *before* supplier quotation begins, matching the client-approved sequence. Receiving is correctly handled by Procurement rather than Warehouse, and supporting documentation upload (e.g., for calibration services) is in place. Confirmed against real records reaching full completion. |
| Substitute Item Review Workflow (including its extension to materials requests) | Completed | 100% | Requestors and Procurement can review and accept or reject a supplier's substitute item offer, for both standard requests and the newer materials-request path. Confirmed against real decisions on file for both paths. |
| Request-editing correction under revision status | Completed | 100% | A permissions gap that could allow certain saved edits to a request to silently fail to save, specifically after that request had been sent back for revision, has been corrected. |

## **4. Completed Work**

| Completed Item | Result |
| ----- | ----- |
| Goods requisition — full process | A Goods request can be raised, approved, validated by Warehouse, certified, quoted through suppliers, purchase-ordered, delivered, and received — with optional quality inspection where flagged — matching the client-approved process end to end. |
| Raw Materials requisition — full process | Planning can raise a materials request directly, have it certified, quoted through suppliers, purchase-ordered, delivered, and received with mandatory quality inspection — matching the client-approved process. |
| Services requisition — both entry points, correct sequence | A request can be raised by an employee or directly by Planning; either way, certification now happens before supplier quotation, matching the approved sequence, with Procurement (not Warehouse) completing receiving and optional supporting-document upload for services like calibration. |
| Substitute item review, including the materials-request path | A requestor or Procurement can review and accept or reject a supplier's substitute offer side-by-side against the original request, for both standard and materials requests, unlocking the ability to award that item once accepted. |

## **5. Incomplete or Pending Work**

| Item | Current Progress | Remaining Work | Target Completion |
| ----- | ----- | ----- | ----- |
| Formal sign-off session with the client | The system has been confirmed working correctly through direct inspection of its own records. A joint walkthrough with the client has not yet taken place. | Schedule and run a walkthrough session with the client present, covering each workflow, to produce a formal, witnessed sign-off. | Not yet scheduled |

## **6. Known Bugs or Issues**

| Module | Issue | Impact | Status |
| ----- | ----- | ----- | ----- |
| Materials/Services request editing | A permissions gap meant that editing an existing line on a request that had been sent back for revision could silently fail to save, with no error shown. | A requestor correcting a bounced-back request could lose their edits without realizing it. | Fixed and verified. |
| Services receiving | An earlier fix restricted Procurement's visibility into receiving records too narrowly, briefly hiding already-completed Goods receiving records from Procurement's view when tracing related documents. | Procurement briefly lost visibility into already-closed Goods receiving records. | Fixed and confirmed against the specific case that was reported. |
| Data correction | One specific request record was found stuck in an incorrect status from an earlier issue. | That single record could not move forward until corrected by hand. | Fixed and confirmed resolved. |
| System security housekeeping | A routine security review flagged a number of lower-severity hardening items (no critical or high-severity issues found). | No confirmed impact identified; this is preventative housekeeping rather than an active problem. | Pending — not yet addressed. |

## **7. Process Documentation**

### **Required Main Process**

**Request → Certification → Supplier Quotation → Purchase Order → Delivery → Receiving**

(Raw Materials requests skip the initial request step and start directly at Certification. Services requests may start at either step. Substitute Item Review is a sub-step within the Supplier Quotation stage, and applies to all three request types.)

* **Request** (Goods, and Services raised by an employee)
  * Responsible: Requestor raises it; then Supervisor, then Department Head approve; then Warehouse validates stock and creates the Certification step
  * Information entered: item description, quantity, request type, purpose, date required
  * System action: routes through Approve / Reject / Request Revision at each checkpoint; Warehouse confirms stock and hands off
  * Expected result: an approved request ready for internal certification
  * Possible exception: a rejection closes the request with a reason given to the requestor; a revision request sends it back a step

* **Certification**
  * Responsible: Department Head certifies; Operations Manager gives final approval
  * Information entered: certified items, quantities, purpose (or entered directly by Planning for Raw Materials/Services)
  * System action: on final approval, Procurement is notified the request is ready for supplier quotation
  * Expected result: an approved certification, visible to Procurement
  * Possible exception: a revision restarts the approval sequence from the beginning, per the client's confirmed process

* **Supplier Quotation**
  * Responsible: Procurement prepares and canvasses suppliers; Procurement Manager reviews; Director gives final approval
  * Information entered: supplier list, quotations per item, any substitute items suppliers offer
  * System action: locks in supplier decisions once the round closes; blocks awarding any item with an undecided substitute offer
  * Expected result: an approved quotation round with a supplier chosen per item, ready for purchase order creation
  * Possible exception: a pending substitute decision blocks that specific item from being awarded until decided

* **Purchase Order**
  * Responsible: Procurement prepares; Procurement Manager reviews; Finance Director gives final approval; Procurement then manually sends it to the supplier
  * Information entered: awarded items and prices, VAT breakdown
  * System action: the order is never sent automatically — a deliberate manual action is required
  * Expected result: the supplier receives and acknowledges the order with a delivery schedule
  * Possible exception: a revision or rejection returns the order to the appropriate earlier step with a reason given

* **Delivery**
  * Responsible: Supplier
  * Information entered: delivery schedule, in-progress status updates
  * System action: status is visible in real time to Procurement, Warehouse or Planning, and the original requestor
  * Expected result: goods or services arrive and are ready to be received
  * Possible exception: none beyond standard status visibility

* **Receiving**
  * Responsible: Warehouse (Goods and Raw Materials) or Procurement (Services)
  * Information entered: receiving record details, delivery reference numbers, item-by-item accept/reject decision, quality-inspection flag where applicable
  * System action: any item flagged for quality inspection is routed for approval before the record can close; a closed record can later be reopened if corrections are needed
  * Expected result: a completed, finalized receiving record closing out the request
  * Possible exception: an item awaiting quality approval keeps the record open and blocks closing

### **Sample Process Entry**

**Process:** Supplier Quotation Approval
**Responsible User:** Procurement Manager (reviews), then Director (gives final approval)
**Input:** Finalized quotation results, including any accepted substitute items
**System Action:** Sequential Approve / Reject / Request Revision; on final approval, Procurement is notified the purchase order can be created
**Expected Result:** The quotation round is approved, with all awarded suppliers and items locked in
**Known Limitation:** This step has been verified through direct inspection of the system's own records, but has not yet been confirmed through a walkthrough conducted together with the client.

## **8. Job Completion Declaration**

I confirm that the information in this report accurately shows:

* Work completed
* Work partially completed
* Work not completed
* Known bugs and issues
* Remaining work
* Current system readiness

I understand that daily activities alone do not confirm job completion. Completion will be based on the actual working output of the system.

**Name:** Rovick
**Signature:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
**Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## **9. Client / Reviewer Review**

**Validated Completion:** \_\_\_\_\_\_\_\_\_\_%

**Review Result:**

☐ Job completed
☐ Job substantially completed
☐ Job partially completed
☐ Job not completed

### **Required Corrections**

1.
2.
3.

### **Payment Recommendation**

☐ Release remaining payment
☐ Release partial payment
☐ Hold payment until required work is completed
☐ Return report and invoice for correction

**Reviewed By:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Required Attachments**

1. Invoice
2. Updated list of completed and incomplete work
3. Known bugs and issues list
4. Daily activity report as supporting information only
