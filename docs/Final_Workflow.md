# **Goods Requisition Approval and Fulfillment Workflow**

### **1\. Purpose**

This defines the confirmed end-to-end approval and fulfillment workflow for Goods Requisitions, from the initial request through receiving. It reflects the process reviewed and approved by the client and serves as the reference standard for implementation.

### **2\. Scope**

This workflow applies specifically to requests classified as Goods, beginning at the PR1 (Purchase Request) stage through to final receiving (GRN).

### **3\. Approval Actions**

At every approval checkpoint in this workflow, the assigned approver has exactly three possible actions.

| Action | Effect |
| ----- | ----- |
| Approve | The request advances to the next approver or process step. |
| Reject | The request is closed. The original requestor is notified together with the rejection reason. |
| Request Revision | The request is returned to the previous step for correction. Once corrected, it re-enters the same approval stage. |

### **4\. Process Overview**

| Order | Document | Purpose |
| ----- | ----- | ----- |
| 1 | PR1 – Purchase Request | The employee raises the initial request. |
| 2 | PR2 – Purchasing Request | Internal certification authorizing Procurement to proceed. |
| 3 | RFQ – Request for Quotation | Supplier canvassing and quotation evaluation (part of the PR2 process). |
| 4 | PO – Purchase Order | Formal purchase order issued to the selected supplier. |
| 5 | Delivery | Supplier fulfillment and delivery tracking. |
| 6 | GRN – Goods Receipt Note | Confirmation that goods have been received. |

### **5\. Detailed Workflow**

#### **5.1 PR1 – Purchase Request**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 1 | Creates a Purchase Request (PR1) and classifies it as a Goods request. | Requestor |
| 2 | Reviews the request. Approve / Reject / Request Revision. | Supervisor (Reviewer) |
| 3 | Performs approval. Approve / Reject / Request Revision. | Department Head (Approver) |
| 4 | Validates stock availability. Upon completing validation, Warehouse creates the PR2, is recorded as Prepared By, and advances the request to the PR2 stage. | Warehouse (Validator) |

**Note:** During validation, Warehouse may adjust the requested quantity to reflect actual stock availability (e.g., partial fulfillment). Any change to the requested quantity must be accompanied by a remark explaining the adjustment.

#### **5.2 PR2 – Purchasing Request**

The PR2 enters its approval workflow immediately upon creation by the Warehouse.

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 5 | Certifies the PR2. Approve / Reject / Request Revision. Recorded as Certified By. | Department Head (Certifier) |
| 6 | Provides final approval of the PR2. Approve / Reject / Request Revision. Upon approval, the system automatically notifies Procurement that the request is ready for supplier canvassing; Procurement Staff then proceeds to create the RFQ (see Step 7). | Operations Manager (Approver) |

*Note: The RFQ is considered a continuation of the PR2 process (the canvassing stage), not a separate or unrelated document.*

#### **5.3 RFQ – Request for Quotation**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 7 | Prepares the RFQ, canvasses suppliers, and records supplier quotations. Recorded as Prepared By. | Procurement Staff (Preparer) |
| 8 | Reviews the canvassing results. Approve / Reject / Request Revision. | Procurement Manager (Reviewer) |
| 9 | Provides final approval of the RFQ. Approve / Reject / Request Revision. Upon approval, Procurement Staff is notified that the PR2 process is complete and the Purchase Order may be created. | Director (Approver) |

#### **5.4 PO – Purchase Order**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 10 | Creates the Purchase Order. Recorded as Prepared By. | Procurement Staff (Preparer) |
| 11 | Reviews the Purchase Order. Approve / Reject / Request Revision. | Procurement Manager (Reviewer) |
| 12 | Provides final approval of the Purchase Order. Approve / Reject / Request Revision. Upon approval, Procurement Staff is notified that the PO is ready to be sent to the supplier. | Finance Director (Final Approver) |
| 13 | Manually selects Send PO to Supplier. This is a deliberate manual action; the PO is not sent automatically after approval. | Procurement Staff (Sender) |

#### **5.5 Supplier & Delivery**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 14 | Receives the Purchase Order, acknowledges it, and provides the planned delivery schedule together with any applicable remarks. | Supplier (Acknowledger) |
| 15 | Updates delivery progress throughout fulfillment. Delivery status is visible in real time to Procurement, Warehouse, and the original Requestor. | Supplier (Updater) |

### **5.6 Receiving & GRN**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 16 | Receives the delivered goods against the Delivery Receipt (DR). Inspects each item individually and accepts or rejects it based on physical condition and specification match. Items not accepted are not received; the rejection is noted directly on the supplier's DR instead. | Warehouse (Receiver) |
| 17 | Creates the Goods Receipt Note (GRN) for the accepted items, manually recording the GRN number, DR number,INV number, and DR date. | Warehouse (Preparer) |
| 18 | May flag a specific item within the GRN as requiring QA inspection, even though the item is not classified as a Raw Material (e.g., select packaging or supply items that are only occasionally tested). This is a per-item, case-by-case decision made by Warehouse. | Warehouse (Preparer) |
| 19 | Inspects flagged item(s) and marks each as Approved on the GRN once testing is complete. This step only applies to items flagged in Step 18\. | TSQA (Approver) |
| 20 | Closes the GRN once all items — including any QA-flagged items — have been resolved. If any item remains unaccepted or pending QA approval, the GRN stays in Pending status and cannot be closed. A closed GRN may later be reopened by Warehouse or Procurement if corrections are required. | Warehouse (Preparer) |
| 21 | Prints the finalized GRN, completing the fulfillment cycle for the requisition. | Warehouse (Preparer) |

# **Raw Materials Requisition Approval and Fulfillment Workflow**

### **1\. Purpose**

This defines the confirmed end-to-end approval and fulfillment workflow for Raw Materials Requisitions, from request initiation through receiving and quality assurance. It reflects the process reviewed and confirmed by the client and serves as the reference standard for implementation.

### **2\. Scope**

This workflow applies specifically to requests classified as Raw Materials.

Raw Materials are requested exclusively by **Planning**, based on their Materials Requirement Planning (MRP) and production forecast. No other requestor type (e.g., regular Employee/End User) is authorized to request Raw Materials.

Raw Material items include, but are not limited to: **paper, ink, glue, varnish, and BOP**, and generally refer to the main materials used directly in the client's product.

**Key distinction from the standard Goods workflow:** Raw Material requests do not pass through PR1 and do not require Warehouse validation prior to PR2. Planning creates the PR2 directly. Raw Materials also require an additional Quality Assurance (TSQA) inspection and approval step at the Receiving/GRN stage, which does not apply to standard Goods.

### **3\. Approval Actions**

At every approval checkpoint in this workflow, the assigned approver has exactly three possible actions.

| Action | Effect |
| ----- | ----- |
| Approve | The request advances to the next approver or process step. |
| Reject | The request is closed. The original requestor is notified together with the rejection reason. |
| Request Revision | The request is returned to the previous step for correction. Once corrected, it re-enters the same approval stage. |

### **4\. Process Overview**

| Order | Document | Purpose |
| ----- | ----- | ----- |
| 1 | PR2 – Purchasing Request | Planning raises the initial request directly. No PR1 is required for Raw Materials. |
| 2 | RFQ – Request for Quotation | Supplier canvassing and quotation evaluation (continuation of the PR2 process). |
| 3 | PO – Purchase Order | Formal purchase order issued to the selected supplier. |
| 4 | Delivery | Supplier fulfillment and delivery tracking. |
| 5 | GRN & TSQA Approval | Confirmation of receipt and quality assurance testing/approval of raw materials. |

### **5\. Detailed Workflow**

#### **5.1 PR2 – Purchasing Request (Direct Entry Point)**

Unlike standard Goods requests, Raw Material requests originate directly at PR2. There is no PR1 stage and no Warehouse validation step, since Planning is already authorized to raise the request directly.

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 1 | Creates the PR2 directly, classified as a Raw Material request. Recorded as Prepared By. | Planning (Requestor) |
| 2 | Certifies the PR2. Approve / Reject / Request Revision. Recorded as Certified By. | Department Head (Certifier) |
| 3 | Provides final approval of the PR2. Approve / Reject / Request Revision. Upon approval, Procurement is notified that the request is ready for supplier canvassing. | Operations Manager (Approver) |

#### **5.2 RFQ – Request for Quotation**

This stage is identical to the standard Goods workflow.

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 4 | Prepares the RFQ, canvasses raw material suppliers, and records supplier quotations. Recorded as Prepared By. | Procurement Staff (Preparer) |
| 5 | Reviews the canvassing results. Approve / Reject / Request Revision. | Procurement Manager (Reviewer) |
| 6 | Provides final approval of the RFQ. Approve / Reject / Request Revision. Upon approval, Procurement Staff is notified that the Purchase Order may be created. | Director (Approver) |

#### **5.3 PO – Purchase Order**

This stage is identical to the standard Goods workflow.

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 7 | Creates the Purchase Order. Recorded as Prepared By. | Procurement Staff (Preparer) |
| 8 | Reviews the Purchase Order. Approve / Reject / Request Revision. | Procurement Manager (Reviewer) |
| 9 | Provides final approval of the Purchase Order. Approve / Reject / Request Revision. Upon approval, Procurement Staff is notified that the PO is ready to be sent to the supplier. | Finance Director (Final Approver) |
| 10 | Manually selects Send PO to Supplier. This is a deliberate manual action; the PO is not sent automatically after approval. | Procurement Staff (Sender) |

#### **5.4 Supplier & Delivery**

This stage is identical to the standard Goods workflow.

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 11 | Receives the Purchase Order, acknowledges it, and provides the planned delivery schedule together with any applicable remarks. | Supplier (Acknowledger) |
| 12 | Updates delivery progress throughout fulfillment. Delivery status is visible in real time to Procurement, Warehouse, and Planning. | Supplier (Updater) |

#### 

#### 

#### 

#### 

#### **5.5 Receiving, GRN & TSQA Approval**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 13 | Receives the delivered raw materials against the Delivery Receipt (DR). Inspects each item individually and accepts or rejects it based on physical condition and specification match. Items not accepted are not received; the rejection is noted directly on the supplier's DR instead. | Warehouse (Receiver) |
| 14 | Creates the Goods Receipt Note (GRN) for the accepted items, manually recording the GRN number, DR number, INV number, and DR date. | Warehouse (Preparer) |
| 15 | Flags each accepted item within the GRN as Raw Material / For QA Approval, routing it to TSQA for inspection. This flag is mandatory for all Raw Material items. | Warehouse (Preparer) |
| 16 | Inspects the flagged raw material item(s) and marks each as Approved on the GRN once testing is complete. | TSQA (Approver) |
| 17 | Closes the GRN once all items — including QA-approved items — have been resolved. If any item remains pending QA approval, the GRN stays in Pending status and cannot be closed. A closed GRN may later be reopened by Warehouse or Procurement if corrections are required. | Warehouse (Preparer) |
| 18 | Prints the finalized GRN, completing the fulfillment cycle for the requisition. | Warehouse (Preparer) |

# **Services Requisition Approval and Fulfillment Workflow**

### **1\. Purpose**

This defines the confirmed end-to-end approval and fulfillment workflow for Service Requisitions, from request initiation through receiving. It reflects the process reviewed and confirmed by the client and serves as the reference standard for implementation.

### **2\. Scope**

This workflow applies specifically to requests classified as Services (e.g., machine servicing, calibration, and other non-material procurement).

Services follow the same document sequence as Goods: **PR1 → PR2 → RFQ → PO**. However, two points distinguish the Services workflow from the Goods workflow:

1. **Requestor and entry point:** Services may be requested either by an **End User** (entering at PR1) or by **Planning** (entering directly at PR2, with no PR1 required — the same rule that applies to Raw Materials requests).  
2. **Receiving stage:** For Service requests, **Procurement**, rather than Warehouse, receives the completed service and creates the GRN (Goods Receipt Note). No Quality Assurance (TSQA) approval step applies to Services.

Certain services (e.g., calibration services) additionally require supporting compliance documentation — such as a Certificate of Calibration or service report — before the service can be considered received.

### **3\. Approval Actions**

At every approval checkpoint in this workflow, the assigned approver has exactly three possible actions.

| Action | Effect |
| ----- | ----- |
| Approve | The request advances to the next approver or process step. |
| Reject | The request is closed. The original requestor is notified together with the rejection reason. |
| Request Revision | The request is returned to the previous step for correction. Once corrected, it re-enters the same approval stage. |

### **4\. Process Overview**

| Order | Document | Purpose |
| ----- | ----- | ----- |
| 1 | PR1 – Purchase Request (End User entry only) | Employee raises the initial service request. |
| 2 | PR2 – Purchasing Request | Internal certification authorizing Procurement to proceed. Direct entry point for Planning-initiated requests. |
| 3 | RFQ – Request for Quotation | Supplier canvassing and quotation evaluation (part of the PR2 process). |
| 4 | PO – Purchase Order | Formal purchase order issued to the selected supplier. |
| 5 | Delivery | Supplier fulfillment and service delivery tracking. |
| 6 | GRN – Goods Receipt Note | Confirmation that the service has been received, prepared by Procurement. |

### **5\. Detailed Workflow**

#### **5.1 Request Initiation (Two Entry Points)**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 1a | Creates a Purchase Request (PR1) and classifies it as a Service request — for example, machine servicing. | End User (Requestor) |
| 1b | Creates the PR2 directly, classified as a Service request. No PR1 is required, consistent with the Raw Materials entry rule. | Planning (Requestor) |

#### **5.2 PR1 Approval & Handoff (End User entry only)**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 2 | Reviews the request. Approve / Reject / Request Revision. | Supervisor (Reviewer) |
| 3 | Performs approval. Approve / Reject / Request Revision. | Department Head (Approver) |
| 4 | Advances the request from PR1 to PR2, creates the PR2, and is recorded as Prepared By — the same handoff role Warehouse performs for Goods requests. | Warehouse (Validator) |

#### **5.3 PR2 – Purchasing Request**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 5 | Certifies the PR2. Approve / Reject / Request Revision. Recorded as Certified By. | Department Head (Certifier) |
| 6 | Provides final approval of the PR2. Approve / Reject / Request Revision. Upon approval, Procurement is notified that the request is ready for supplier canvassing. | Operations Manager (Approver) |

#### **5.4 RFQ – Request for Quotation**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 7 | Prepares the RFQ, canvasses service suppliers, and records supplier quotations. Recorded as Prepared By. | Procurement Staff (Preparer) |
| 8 | Reviews the canvassing results. Approve / Reject / Request Revision. | Procurement Manager (Reviewer) |
| 9 | Provides final approval of the RFQ. Approve / Reject / Request Revision. Upon approval, Procurement Staff is notified that the Purchase Order may be created. | Director (Approver) |

#### **5.5 PO – Purchase Order**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 10 | Creates the Purchase Order. Recorded as Prepared By. | Procurement Staff (Preparer) |
| 11 | Reviews the Purchase Order. Approve / Reject / Request Revision. | Procurement Manager (Reviewer) |
| 12 | Provides final approval of the Purchase Order. Approve / Reject / Request Revision. Upon approval, Procurement Staff is notified that the PO is ready to be sent to the supplier. | Finance Director (Final Approver) |
| 13 | Manually selects Send PO to Supplier. This is a deliberate manual action; the PO is not sent automatically after approval. | Procurement Staff (Sender) |

#### **5.6 Supplier & Delivery**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 14 | Receives the Purchase Order, acknowledges it, and provides the planned service/delivery schedule together with any applicable remarks. | Supplier (Acknowledger)  |
| 15 | Updates delivery/service progress throughout fulfillment. Status is visible in real time to Procurement, Warehouse, and the original Requestor. | Supplier (Updater) |

#### **5.7 Receiving & GRN**

This is where the Services workflow diverges from the Goods workflow.

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 16 | Receives the delivery. | Warehouse(Receiver) |
| 17 | Reviews each service and determines whether Procurement needs to perform the GRN for that specific service.  | Warehouse  |
| 18 | Clicks the "Forward" button to send the service to Procurement, if Procurement is required to GRN it. | Warehouse  |
| 19 | Once the service is done, clicks the button to forward it to TSQA for QA. | Warehouse / Procurement  |
| 20 | Inspects the flagged service and marks each as Approved on the GRN once testing is complete. | TSQA |
| 21 | Closes the GRN once all services— including QA-approved services — have been resolved. If any item remains pending QA approval, the GRN stays in Pending status and cannot be closed. A closed GRN may later be reopened by Warehouse or Procurement if corrections are required. | Warehouse / Procurement  |
| 22 | Prints the finalized GRN, completing the fulfillment cycle for the requisition. | Warehouse / Procurement  |

#### **5.8 Compliance Documentation (where applicable)**

For services that require supporting documentation — such as calibration — the following applies:

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 23 | Uploads required compliance documents (e.g., Certificate of Calibration, service report) to the Supplier Dashboard, on a dedicated Documentation/Certification page. | Supplier |
| 24 | Does not finalize receipt of the service if required compliance documentation (e.g., Certificate of Calibration) is missing, per the client's stated requirement that such documents accompany delivery. | Procurement |

# **Substitute Item Review and Approval Workflow**

### **1\. Purpose**

This defines the workflow for reviewing and approving substitute items offered by a Supplier during the RFQ/quotation stage, in place of the originally requested item.

### **2\. Scope**

This workflow applies whenever a Supplier submits a substitute item during quotation, in place of the item originally specified in the RFQ. It applies across Goods, Raw Materials, and Services requests, since substitution occurs at the RFQ/canvassing stage shared by all three.

Once the RFQ is approved, the request proceeds into the standard PO, Delivery, and Receiving/GRN stages already defined in the applicable request-type document; this document governs only the substitute-specific review that occurs prior to and during RFQ approval.

### **3\. Approval Actions**

At the substitute review checkpoint, the assigned reviewers have the following possible actions.

| Action | Effect |
| ----- | ----- |
| Accept | The substitute item is approved and becomes eligible to be awarded to that supplier in the canvassing/selection process. |
| Reject | The substitute item is declined. The original requested item specification remains in effect for that line item. |

**Note:** Approval from either the Requestor or Procurement is sufficient to accept a substitute — dual approval from both is not required.

### **4\. Process Overview**

| Order | Stage | Purpose |
| ----- | ----- | ----- |
| 1 | Substitute Submission & Review | Supplier offers a substitute item; Requestor or Procurement accepts or rejects it. |
| 2 | RFQ Approval | Procurement Manager and Director review and approve the finalized RFQ, including any accepted substitutes. |

### **5\. Detailed Workflow**

#### **5.1 Substitute Item Submission & Review**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 1 | During quotation, submit a substitute item in place of the originally requested item (e.g., an alternate brand or specification). | Supplier |
| 2 | Notifies both the original Requestor and Procurement that a substitute item is pending review. | System |
| 3 | Reviews the substitute offer, with the originally requested item shown side-by-side against the supplier's substitute for comparison. | Requestor / Procurement |
| 4 | Accepts or rejects the substitute item. Approval from either party is sufficient to move the substitute forward. | Requestor or Procurement (either party) |
| 5 | Once accepted by either party, the substitute item becomes eligible to be awarded to that supplier in the canvassing/selection process. | System |
| 6 | Once the RFQ/quotation is closed, substitute decisions are locked and cannot be changed. | System |

#### **5.2 RFQ Approval (Procurement Manager & Director)**

| Step | Action | Responsible Party |
| ----- | ----- | ----- |
| 7 | Reviews the finalized canvassing results, including any accepted substitute items, as part of the standard RFQ review. Approve / Reject / Request Revision. | Procurement Manager (Reviewer) |
| 8 | Provides final approval of the RFQ, including any accepted substitutes it contains. Approve / Reject / Request Revision. Upon approval, Procurement Staff is notified that the Purchase Order may be created. | Director (Approver) |

**Continuation:** Once the RFQ is approved (Step 8), the request proceeds into the standard PO, Delivery, and Receiving/GRN stages already defined in the applicable request-type document:

**Client Acknowledgment**

By signing below, the client confirms that the Goods, Raw Materials, Services, and Substitute Item Review workflows documented above have been reviewed and are correct, and that they represent the approved reference standard for implementation.

Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Signature over Printed Name

Position / Title: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

