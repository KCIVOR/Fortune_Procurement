-- Re-wipe requisition/workflow transactional data for clean Goods E2E testing.
-- Preserves: profiles, suppliers, supplier_products, accreditation, workflow definitions.

DELETE FROM grn_items;
DELETE FROM grn_receipts;
DELETE FROM delivery_status_history;
DELETE FROM deliveries;
DELETE FROM po_items;
DELETE FROM po_receipts;
DELETE FROM po_requests;
DELETE FROM pr2_items;
DELETE FROM pr2_requests;
DELETE FROM rfq_quote_attachments;
DELETE FROM substitute_decisions;
DELETE FROM supplier_item_selections;
DELETE FROM rfq_item_quotes;
DELETE FROM rfq_suppliers;
DELETE FROM rfq_batches;
DELETE FROM warehouse_validation_items;
DELETE FROM warehouse_validations;
DELETE FROM pr1_attachments;
DELETE FROM pr1_items;
DELETE FROM pr1_requests;

DELETE FROM approval_actions
WHERE instance_id IN (
  SELECT id FROM approval_instances
  WHERE document_type IN ('PR1', 'PR2', 'PO', 'RFQ')
);
DELETE FROM approval_instances
WHERE document_type IN ('PR1', 'PR2', 'PO', 'RFQ');

DELETE FROM audit_logs
WHERE document_type IN ('PR1', 'PR2', 'PO', 'RFQ', 'GRN');

DELETE FROM notifications
WHERE document_type IN ('pr1', 'pr2', 'po', 'rfq', 'delivery', 'grn');
