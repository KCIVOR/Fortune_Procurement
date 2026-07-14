# Supplier Supply Type — Design

**Date:** 2026-07-14  
**Status:** Approved for implementation

## Problem

Procurement has no account-level way to mark what kind of supplier an account is. Today “raw material / goods / services” live only on PR lines (`is_raw_material`, `request_type`) and products (`item_type`), not on the supplier profile.

## Definitions (product language)

| Type | Meaning |
|------|---------|
| Raw material supplier | Supplies inputs (glue, cardboard, etc.) |
| Normal supplier | Supplies regular goods (ballpen, paper, etc.) — not raw materials |
| Service supplier | Offers services (calibration, etc.) |

## Decisions

| Decision | Choice |
|----------|--------|
| Cardinality | **Exclusive** — exactly one type when set |
| Storage | `profiles.supplier_supply_type` text, **nullable** for non-suppliers; new **supplier** accounts default to `normal` |
| Allowed values | `raw_material` \| `normal` \| `service` |
| Display labels | Raw mat supplier · Non raw mat supplier · Service supplier |
| Who sets it | Procurement and admin only |
| Where | `/suppliers/[id]` account detail (next to VAT card) |
| New suppliers | Default `normal` (Non raw mat) on invite / create / bulk-import; admin/edge create when role is supplier |

## Non-goals (v1)

- Multi-select types
- Inferring type from `supplier_products.item_type`
- Changing `pr1_items.is_raw_material` or RFQ/canvassing rules based on this field
- Supplier self-service of this field

## Write path

Mirror VAT: Next.js `PATCH` route using the caller’s JWT for authz, service-role client for the profile update + `audit_logs` insert (profiles column UPDATE grants are restricted).

## Future (out of plan)

Optional list badge; optional enforcement / filtering against products or RFQ lines.
