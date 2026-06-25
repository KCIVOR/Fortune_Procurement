-- Prevent duplicate supplier invitations on the same RFQ at the DB level.
-- Backstops the application-level dedup guards in lib/canvassing.ts
-- (assignSuppliers / addExternalVendorToRfq) against retries and double-clicks.

-- Registered suppliers: one row per (rfq_id, supplier_id).
create unique index if not exists rfq_suppliers_unique_registered
  on rfq_suppliers (rfq_id, supplier_id)
  where supplier_id is not null;

-- External vendors (supplier_id is null): one row per (rfq_id, lower(name)).
create unique index if not exists rfq_suppliers_unique_external
  on rfq_suppliers (rfq_id, lower(supplier_name_snapshot))
  where supplier_id is null;
