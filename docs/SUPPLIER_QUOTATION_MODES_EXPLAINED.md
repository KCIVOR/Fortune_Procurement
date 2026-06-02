# Supplier Quotation Entry Modes - Explained

**Date:** June 2, 2026  
**Feature:** Submit Quotation Page - Three Product Entry Options  
**Audience:** Suppliers submitting quotations

---

## 🎯 Overview

When submitting a quotation for an RFQ, suppliers have **4 options** for each line item:

1. **Select Catalog Product** 📦
2. **Manual Entry** ✏️
3. **Propose New Product** ➕
4. **No Quote** 🚫

Each option serves a different purpose depending on the situation.

---

## 📦 Option 1: Select Catalog Product

### What It Is:
Choose an existing product from your **Product Catalog** that you've already added and submitted to the system.

### When to Use:
- You have the product already in your catalog
- The product matches what the buyer requested
- You want to link your quote to a tracked product

### How It Works:
1. Click **"Select Catalog Product"** button
2. A dialog opens showing all your catalog products
3. Pick the product that matches the requested item
4. Fill in the **unit price** and **lead time** for this quotation
5. The product details (name, code, specs) are automatically pulled from your catalog

### Product Status:
Your catalog products can have different verification statuses:
- ✅ **Verified** (green badge) - Approved by Procurement/TSQA
- ⚠️ **Pending Review/Under Review/Pending TSQA** (amber badge) - Submitted but not yet verified

**Note:** You can quote with either verified or pending products. Procurement will see the verification status during canvassing.

### Advantages:
- ✅ Faster entry (product details pre-filled)
- ✅ Links to your verified products
- ✅ Procurement can see your product specs
- ✅ Builds your product catalog over time
- ✅ Product can be reused for future RFQs

### Example:
> **RFQ Item:** "Rust Inhibitor Primer - 5L"  
> **Your Action:** Select your catalog product "Rust Guard Premium Primer" that's already verified  
> **Result:** Quote links to verified product, Procurement sees full product details

---

## ✏️ Option 2: Manual Entry

### What It Is:
Submit a quote **without linking to any product** in your catalog. You provide all the details manually for this specific quotation only.

### When to Use:
- You don't have this product in your catalog yet
- It's a one-time or rarely-purchased item
- You don't want to add it to your permanent catalog
- You need to quote quickly without going through product creation

### How It Works:
1. Click **"Manual Entry"** button
2. A gray info panel appears explaining the mode
3. Fill in the **description** field with the product/item details
4. Fill in the **unit price** and **lead time**
5. No product link is created - this quote stands alone

### What Procurement Sees:
- Your description exactly as you typed it
- A **"Manual Entry"** badge (slate/gray color)
- Price and lead time
- No link to your product catalog

### Advantages:
- ✅ Quick and simple
- ✅ No need to create a catalog product
- ✅ Good for one-off items
- ✅ Less administrative work

### Disadvantages:
- ❌ No reusable product record
- ❌ Procurement sees less structured information
- ❌ Can't track this product for future RFQs
- ⚠️ For **raw material** lines, Procurement may request justification before awarding

### Example:
> **RFQ Item:** "Custom fabricated bracket - 50mm x 30mm"  
> **Your Action:** Choose Manual Entry, type description: "Custom steel bracket per drawing DWG-123, powder coated"  
> **Result:** Quote submitted with your description, no catalog link

---

## ➕ Option 3: Propose New Product

### What It Is:
Submit a **new product** to your catalog while submitting this quotation. The product is added to your catalog in "pending" status for Procurement/TSQA to review and verify.

### When to Use:
- You want to quote a product that's not in your catalog yet
- You want to **add it to your catalog** for future use
- You're willing to wait for Procurement/TSQA verification
- This is a product you'll supply regularly

### How It Works:
1. Click **"Propose New Product"** button
2. A blue panel opens with a product proposal form
3. Fill in the **product details**:
   - **Product Name** (required)
   - Product Code (optional)
   - Category (optional)
   - Description (optional)
   - Specifications (optional)
4. Click **"Submit Proposal"**
5. The product is added to your catalog in **"Pending Review"** status
6. Continue filling price and lead time for your quotation

### Product Validation Process:
After you propose:
1. Product appears in your **Product Catalog** with "Pending" status
2. Procurement reviews the product details
3. They may:
   - Verify it directly (if it's standard/known)
   - Send it to TSQA for technical evaluation
   - Request more information
4. Once verified, the product status changes to "Verified"

### What Procurement Sees:
- Your proposed product details
- A **"Pending Validation"** badge (amber/warning color)
- For **raw materials**: Procurement must justify before awarding until product is verified
- For **non-raw materials**: Can award but sees pending status

### Advantages:
- ✅ Builds your product catalog
- ✅ Product becomes reusable for future RFQs
- ✅ Shows Procurement full product specifications
- ✅ Once verified, same as selecting catalog product

### Disadvantages:
- ⚠️ Requires validation before awarding (for raw materials)
- ⚠️ More fields to fill than manual entry
- ⚠️ Procurement may request additional documentation

### Example:
> **RFQ Item:** "Industrial Lubricant - SAE 30"  
> **Your Action:** Propose new product "HydraFlow SAE 30 Lubricant" with specs: "Mineral oil, SAE 30, meets API SL standard"  
> **Result:** Product added to your catalog pending verification, quote links to it

---

## 🚫 Option 4: No Quote

### What It Is:
Decline to provide a quote for this line item, with a reason.

### When to Use:
- You cannot supply the item
- Item is out of stock or discontinued
- Lead time is too long for buyer's needs
- Item doesn't match your product range

### How It Works:
1. Click **"No Quote"** button
2. Select a reason from dropdown:
   - "Out of stock"
   - "Discontinued product"
   - "Lead time exceeds requirement"
   - "Not within product range"
   - "Other" (requires description)
3. If "Other", provide a brief explanation

### What Procurement Sees:
- **"No Quote"** status
- Your reason for declining
- This line is excluded from your quotation

### Example:
> **RFQ Item:** "Specialized chemical compound XYZ-500"  
> **Your Action:** Select No Quote → Reason: "Not within product range"  
> **Result:** Line marked as unquoted, Procurement knows you can't supply it

---

## 🧪 Special Case: Raw Materials

### What Are Raw Materials?
Some RFQ items are marked as **"Raw Material"** by the buyer (shown with a 🧪 badge). These are critical materials that require extra validation.

### Warning When Using Manual Entry or Unverified Products:
If you select **Manual Entry** or **Propose New Product** (or pick an unverified catalog product) for a raw material line, you'll see a **warning message**:

> ⚠️ **"This is a raw material line. You may submit with a manual entry / newly proposed product (pending validation); procurement will see the verification status during canvassing and may request justification before awarding."**

### What This Means:
- ✅ You **can still submit** your quotation
- ⚠️ Procurement will see the verification status
- ⚠️ They may **request justification** before awarding the contract
- ✅ Using a **verified catalog product** avoids this extra step

### Best Practice for Raw Materials:
1. **Preferred:** Use verified catalog products
2. **Acceptable:** Propose new product (but expect validation delay)
3. **Use with caution:** Manual entry (Procurement may need more details)

---

## 📊 Comparison Table

| Feature | Select Catalog Product | Manual Entry | Propose New Product |
|---------|----------------------|--------------|-------------------|
| **Speed** | Fast (if product exists) | Fastest | Moderate |
| **Product Link** | ✅ Yes | ❌ No | ✅ Yes (pending) |
| **Reusable** | ✅ Yes | ❌ No | ✅ Yes (after verification) |
| **Validation Required** | Only if pending | N/A | ✅ Yes |
| **Good for Raw Materials** | ✅ Best choice | ⚠️ Use with caution | ⚠️ Expect extra review |
| **Procurement Sees** | Full product details + status | Your description only | Full product details + pending status |
| **Future RFQs** | Product ready to reuse | Must re-enter manually | Product ready after verification |

---

## 🎯 Decision Guide

### Choose **Select Catalog Product** when:
- ✅ You have the product in your catalog already
- ✅ You want fastest submission with verified product
- ✅ Item is a raw material (use verified products)

### Choose **Manual Entry** when:
- ✅ One-time or rare item
- ✅ You don't want to maintain in catalog
- ✅ Quick quote needed
- ⚠️ Item is NOT a critical raw material

### Choose **Propose New Product** when:
- ✅ You'll supply this product regularly
- ✅ You want it in your catalog for future RFQs
- ✅ You can provide full product specifications
- ⚠️ You understand verification may be needed

### Choose **No Quote** when:
- ✅ You cannot supply the item
- ✅ Item doesn't match your capabilities

---

## 💡 Pro Tips

### Building Your Catalog:
- Start adding common products to your catalog early
- Use **Propose New Product** to build your catalog while quoting
- Verified products make future quotations faster

### For Raw Materials:
- Always prefer **verified catalog products**
- If proposing new, include detailed specifications
- Avoid manual entry unless absolutely necessary

### Switching Modes:
- You can switch between modes at any time before submitting
- If you change from "Propose New Product" after submitting the proposal, you can cancel it
- Each line item can use a different mode

### Instructions in the System:
The quotation page shows:
> **Per item, choose: catalog product, manual entry, propose new product, or No Quote**
> **Quoted lines need price and lead time**
> **Catalog products may be verified or pending — procurement sees the status during canvassing**

---

## 🔄 Workflow Example

### Scenario: Supplier receives RFQ with 3 items

**Item 1:** "Paint - White Gloss 5L" (Raw Material 🧪)
- **Decision:** Select Catalog Product
- **Reason:** Have verified "ProCoat White Gloss" in catalog
- **Action:** Pick product, enter price ₱500, lead time 5 days
- **Result:** ✅ Fast quote, verified product, no extra validation

**Item 2:** "Custom signage bracket"
- **Decision:** Manual Entry
- **Reason:** One-off custom fabrication
- **Action:** Enter description "Custom aluminum bracket per drawing B-123", price ₱1,200, lead time 10 days
- **Result:** ✅ Quick quote, no catalog clutter

**Item 3:** "Industrial Degreaser - 20L" (Raw Material 🧪)
- **Decision:** Propose New Product
- **Reason:** Don't have in catalog yet, will supply regularly
- **Action:** Propose "CleanMax Industrial Degreaser" with specs, enter price ₱3,500, lead time 7 days
- **Result:** ⚠️ Quote submitted, product pending verification, Procurement may need justification

---

## 📞 Summary

- **Select Catalog Product** = Use existing verified/pending products from your catalog
- **Manual Entry** = Quick quote without catalog link, one-time description
- **Propose New Product** = Add new product to catalog while quoting, requires validation
- **No Quote** = Cannot supply, with reason

Choose the option that best matches your needs and the item type!

---

**Created:** June 2, 2026  
**For:** Suppliers using the Submit Quotation page  
**Related:** Product Catalog, RFQ, Raw Materials, Canvassing

