**1\. VAT Handling**

* Add a VAT-able / Non-VAT flag on the supplier profile page  
* Should automatically reflect on the PO once set  
* **Additional complexity**: suppliers sometimes submit quotations as VAT-IN or VAT-EX — the system needs to handle the computation correctly depending on what the supplier sent  
* **Proposed Solution**: add the VAT-able flag on the supplier profile as the default. Additionally, add a VAT-IN / VAT-EX indicator on the quotation submission form so suppliers can explicitly indicate their price type per quotation. System will compute the PO based on the quotation indicator, and fall back to the supplier profile flag if not indicated  
  ---

**2\. PR Assignment to Buyer**

* Add a button/dropdown on the canvassing/RFQ page to manually assign which procurement buyer will process a specific PR  
* Also useful for tracing and advance inquiry cases  
* **Proposed Solution**: All PRs will be visible on the procurement dashboard. A button will be added on the canvassing/RFQ page with a dropdown list of procurement staff, allowing the team to manually assign the PR to the appropriate buyer  
  ---

**3\. Accreditation Expiry per Document**

* Current setup: fixed number of months only (set by admin, applies to all)  
* Requested: per-supplier/per-document validity date that can be set manually, or ideally auto-detected from the uploaded document  
* Plus email/system notification when expiry is approaching  
* **Proposed Solution**: Add a field on the accreditation approval page where procurement can manually set the expiry date upon approval. Auto-scan of uploaded documents to detect validity dates is still under evaluation due to varying document formats — to be confirmed  
  ---

**4\. Product Review Module — TSQA Route**

* Current flow does not match Fortune's actual internal process  
* The team clarified that raw material review goes through an RSE (Request for Sample Evaluation) process handled by QA, not supplier-initiated through the system  
* **Proposed Solution**: Needs redesign and further discussion — exact TSQA route to be confirmed with the procurement team before implementation  
  ---

**5\. Substitute Item — Procurement Accept/Reject on Behalf of Employee**

* Currently, only the employee (requestor) can accept or reject a substitute item offered by the supplier  
* The procurement team requested the ability to also accept or reject the substitute item on behalf of the requestor  
* **Proposed Solution**: Add an accept/reject action for procurement on the same substitute review page, allowing procurement to act on behalf of the employee when needed  
  ---

**6\. RFQ — Reopen Once Closed**

* Once an RFQ is closed, it cannot currently be reopened  
* The procurement team requested that a closed RFQ should be reopenable to allow changes such as supplier price updates or other modifications  
* **Proposed Solution**: Add a reopen action on closed RFQs to allow procurement to reactivate it for editing when necessary  
  ---

**7\. GRN — Reopen and Edit Once Closed**

* Once a GRN is closed, it is no longer editable  
* The procurement team requested that a closed GRN should still be reopenable for editing and updating  
* **Proposed Solution**: Add a reopen action on closed GRNs to allow updates after closing, applicable to both warehouse and procurement-handled GRNs  
  ---

**8\. GRN for Services — Handled by Procurement**

* Currently, GRN is handled by the warehouse  
* For service-type PRs, the warehouse is not involved — procurement should be the one closing the GRN instead  
* **Proposed Solution**: On the same GRN page/module, allow procurement to close the GRN for service-type transactions, in addition to the existing warehouse flow  
* 

---

**9\. Priority Level — Visibility, Permission, and Filtering**

* Currently, only approvers have permission to change the priority level of a request  
* Procurement has no visibility on the priority level across the different lists in the system, making it difficult to determine which requests to process first  
* **Requested Changes:**  
  * Allow the **requestor** to update the priority level of their request even after submission  
  * Add a **priority level column** across all lists system-wide for visibility  
  * Add a **priority level filter** across all lists system-wide for easier sorting and processing  
* **Proposed Solution:** Extend priority level edit permission to requestors at any point after submission. Add a priority level column and filter across all modules and lists throughout the system so procurement and other roles can easily identify and sort requests by urgency

---

**10\. Remarks on PR1 Request Creation**

* Requestors currently have no way to add free-text remarks/notes when creating a PR1 request
* Add a remarks field on the PR1 request creation form so the requestor can provide additional context or special instructions
* **Proposed Solution**: Add an optional remarks/notes field to the PR1 creation form, stored on the request and visible to downstream approvers/procurement

---

**11\. Supplier Product Registration — Handled by Procurement**

* Currently the supplier-facing flow is the entry point for a supplier's products in the system
* The team requested that procurement be the one to register a supplier's product instead of the supplier
* **Proposed Solution**: Move product registration into procurement's control — procurement registers/maintains products on behalf of the supplier; supplier write access to the product catalog is removed
* *Note: recent work (catalog ownership, removal of supplier write access to `supplier_products`) may already cover most of this — audit to confirm what remains*

---

**12\. Warehouse — Change Request Quantity**

* Warehouse currently cannot change the requested quantity of a request
* The team requested that warehouse be able to update the request quantity
* **Proposed Solution**: Allow warehouse to edit the request quantity on a request; exact stage/scope (which quantity, which document in the chain) and downstream recomputation to be confirmed during audit

