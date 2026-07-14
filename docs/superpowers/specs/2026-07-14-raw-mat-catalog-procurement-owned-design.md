# Raw-mat catalog (procurement-owned) + quote access — Design

**Date:** 2026-07-14  
**Status:** Draft for implementation (approved requirements from product conversation + code/DB audit)

## Goals

1. Suppliers **cannot** upload/create/edit catalog products.
2. **Procurement** creates catalog products **for raw mat suppliers only**, already **`verified`**.
3. Catalog sidebar + `/supplier/products` only for **raw mat** suppliers → **read-only**.
4. **Non raw mat** and **service** suppliers: no catalog nav, URL blocked; they quote **manually** on RFQs.
5. No TSQA / RSE / verify-next-step for this upload path — upload = done = offerable.
6. Suppliers who already have any `supplier_products` rows → set `supplier_supply_type = 'raw_material'`.
7. **Temporary:** raw mat suppliers **may still quote on services RFQs** (manual entry; see audit).

## Non-goals (this plan)

- Removing the entire `/tsqa` app module (only disconnect product-catalog RSE/TSQA path).
- Changing award logic beyond removing reliance on pending review for procurement-created verified rows.
- Renaming DB enum `normal` → something else (display stays “Non raw mat supplier”).

## Evidence (audit summary — live DB + code)

### Live DB (`emddvbocupvufzvhcacz`)

| Fact | Value |
|------|--------|
| Suppliers | 10, all currently `supplier_supply_type = 'normal'` |
| `supplier_products` | 47 rows: verified goods 37, verified services 3, expired goods 5, draft goods 1, rejected goods 1 |
| Suppliers with ≥1 product | 8 of 10 (2 have zero) |
| Quotes with linked product | 10 (9 goods, 1 services) |

### Quoting (code)

- Manual quote entry is **always** available on goods **and** services RFQs (`app/supplier/quotations/[rfqSupplierId]/page.tsx`).
- Catalog picker does **not** filter by `item_type` or `supplier_supply_type`.
- Soft confirm on catalog type mismatch; submit/award do **not** hard-block services product on goods RFQ or reverse.
- Therefore: **yes, a raw-mat supplier can quote a services RFQ today via manual entry** (temporary keep).

### Catalog ownership (code)

- Supplier INSERT/UPDATE RLS + UI create/submit (`lib/supplier-products.ts`, migrations `20260507000200` / `20260507120000`).
- Procurement has UPDATE (verify) but **no INSERT** policy for `supplier_products`.
- `supplier_supply_type` not on `UserProfile` / `fetchUserProfile` — cannot gate sidebar/routes until loaded in session.
- RSE/TSQA optional path: `createRSEFromSupplierProduct` → `pending_tsqa` → `submitTSQAResult`.

## Target behavior

| Actor | Catalog | Quoting |
|-------|---------|---------|
| Raw mat supplier | Read-only list/detail of own products | Catalog pick (goods catalog) + **manual on services RFQ (temp)** + manual on goods if allowed today |
| Non raw mat / Service supplier | No nav, URL denied | Manual only (no catalog pick; propose-new removed) |
| Procurement | Create verified product for raw-mat supplier; no RSE/TSQA for that path | Unchanged award UI except links to product detail |

## Temporary “quote services” rule

Until revoked by product:

- Raw mat suppliers remain eligible for **services** RFQ invitations and **manual** (and existing catalog-link) quoting.
- Do **not** add a hard block on `request_type === 'services'` for `supplier_supply_type === 'raw_material'` in this plan.
- Document a later task to remove this if client wants raw-mat → goods-only RFQs.
