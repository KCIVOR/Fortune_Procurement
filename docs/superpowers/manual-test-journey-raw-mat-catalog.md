# Manual test journey — Procurement-owned raw-mat catalog

Use this after logging into `http://localhost:3000` on branch `feat/supplier-supply-type`.

## Accounts (from live DB)

| Role | Suggested login | Supply type | Notes |
|------|-----------------|-------------|--------|
| Procurement | `procurement@fortune.com` | — | Creates catalog products |
| Raw mat supplier | `supplier@fortune.com` (Ace Supply Corp) | `raw_material` | Has 5 products; catalog read-only |
| Non raw mat supplier | `kertutilmi@necub.com` (kertutilmi) | `normal` | 0 products; no catalog |
| Alt non raw mat | `rvckmlnrmsnt@gmail.com` | `normal` | 0 products |

*(Use your known demo password for `@fortune.com` accounts.)*

Mark each step Pass / Fail.

---

## Journey A — Procurement adds a verified product

**Login:** Procurement  

| # | Step | Expected |
|---|------|----------|
| A1 | Open sidebar → **Product Review** (`/accreditation/products`) | Queue loads |
| A2 | Click **Add product** | Opens `/accreditation/products/new` |
| A3 | Open supplier dropdown | Only **raw mat** suppliers listed (Ace, Metro, Prime Tech, …). Non raw mat (kertutilmi, Rovick) **not** listed |
| A4 | Select **Ace Supply Corp**, fill name e.g. `Test Glue Stick`, item type **Goods**, optional code/category | Form accepts |
| A5 | Save | Redirect to product detail; status **Verified** (or equivalent chip) |
| A6 | Confirm **Create RSE for TSQA** is **gone** | No RSE create button/panel |
| A7 | Optional: set supply type of a non–raw-mat supplier on `/suppliers/[id]` cannot make them appear in Add Product until set to **Raw mat supplier** | Only raw mat in picker |

---

## Journey B — Raw mat supplier (read-only catalog)

**Login:** Ace — `supplier@fortune.com`  

| # | Step | Expected |
|---|------|----------|
| B1 | Sidebar | **Product Catalog** **is visible** |
| B2 | Open Product Catalog | List shows existing products (+ new one from A if created for Ace) |
| B3 | Confirm no **Add to Catalog** / create CTA | Read-only list |
| B4 | Open a product detail | Can view name/status/docs; **no** Edit, Submit, Withdraw, Re-verify, Upload |
| B5 | Try URL `/supplier/products/new` | Redirects away; cannot create |
| B6 | Open an open quotation (`/supplier/quotations/...`) | Modes: **Select Catalog Product** + **Manual entry** + **No Quote** |
| B7 | Catalog pick | Can select a **verified** catalog product and submit line |
| B8 | Manual entry | Still works (including if RFQ is **Services** — temporary rule) |

---

## Journey C — Non raw mat supplier (no catalog)

**Login:** `kertutilmi@necub.com` (or Rovick account)  

| # | Step | Expected |
|---|------|----------|
| C1 | Sidebar | **Product Catalog** **hidden** |
| C2 | Go to `/supplier/products` directly | Access denied / redirect to dashboard — **cannot** use catalog |
| C3 | Open a quotation | **No** catalog pick; **Manual entry** + **No Quote** only |
| C4 | Submit a line with manual description + price | Succeeds (manual quote path) |

---

## Journey D — Service supplier (same as non raw mat for catalog)

If you have (or set) a supplier with supply type **Service supplier** on `/suppliers/[id]`:

| # | Step | Expected |
|---|------|----------|
| D1 | Same as C1–C4 | No catalog; manual quote only |

*(Today seed data may have no `service` type user — set one manually via procurement Supplier Accounts → Supply type → Service supplier, then re-login as that supplier.)*

---

## Journey E — Supply type toggle (procurement)

**Login:** Procurement  

| # | Step | Expected |
|---|------|----------|
| E1 | Open `/suppliers` → pick a **non raw mat** supplier (0 products) | Detail shows supply type **Non raw mat supplier** |
| E2 | Change to **Raw mat supplier** → Save | Persists after reload |
| E3 | Add Product form | That supplier now appears in the raw-mat list |
| E4 | Log in as that supplier | Product Catalog appears (empty until procurement adds products) |
| E5 | Change back to Non raw mat → supplier re-login | Catalog disappears again |

---

## Journey F — Quotation smoke (raw mat + manual services)

**Prep:** Have or create a **Services** RFQ invited to Ace (`supplier@fortune.com`).

| # | Step | Expected |
|---|------|----------|
| F1 | Ace opens the services quotation | Form loads; can use **Manual entry** (and catalog if product listed) |
| F2 | Manual quote a service line → submit | Allowed (**temporary** raw-mat may quote services) |

---

## Quick fail signals

- Non raw mat sees Product Catalog in sidebar → **fail** gate  
- Supplier can still Add / Submit product → **fail** ownership  
- Procurement Add Product lists non–raw-mat suppliers → **fail** API/UI filter  
- New product lands as Draft/Submitted (not Verified) → **fail** create API  
- Create RSE still on product detail for new flow → **fail** Task 4  

## Pass criteria

All of **A**, **B**, and **C** pass. **D/E/F** as available in your environment.
