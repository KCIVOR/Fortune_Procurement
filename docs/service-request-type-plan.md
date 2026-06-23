# Service Request Type — Implementation Plan

This document outlines the step-by-step plan for implementing the **Service Request Type** feature in the Fortune Procurement System. This feature allows users to classify a Purchase Request (PR1) as either **Goods** or **Services**, routing both request types through the identical workflow path while adapting the UI to handle intangible service validation cleanly.

---

## Technical Scope & Rules
*   **Request Type Classification**: Added at the PR1 header level (`pr1_requests.request_type = 'goods' | 'services'`). Mixing goods and services in a single PR1 is disallowed.
*   **Workflow Consistency**: Both request types travel through the exact same workflow path (PR1 Creation → PR1 Approvals → Warehouse Validation → RFQ/Canvassing → PR2/PO Approvals → Delivery/Execution → GRN Closure).
*   **Surgical Adaptations**:
    *   **Services SOH Bypass**: In the Warehouse Validation and Details screens, physical Stock-on-Hand (SOH) columns/inputs will display `N/A`.
    *   **Backend Compatibility**: For Services requests, validation item inputs default to `validated_soh = 0` under the hood. This ensures `computeWarehouseItemRouting` automatically routes 100% of the requested quantity to procurement (outsourcing) without breaking any database RLS or validation rules.
    *   **GRN Closure**: The GRN receipt generation screen and status transitions remain unchanged, handling services exactly like goods.

---

## Sequential Phases

### Phase 1: Database Migration
Create a SQL migration to add the request classification column to the PR1 header table with default value 'goods' for backward compatibility.

*   **Files to Create**:
    *   [supabase/migrations/20260623120000_pr1_requests_add_request_type.sql](file:///c:/Users/Rovick/Desktop/project/supabase/migrations/20260623120000_pr1_requests_add_request_type.sql) [NEW] — SQL migration adding `request_type TEXT NOT NULL DEFAULT 'goods' CHECK (request_type IN ('goods', 'services'))` to `pr1_requests`.

---

### Phase 2: Type Definitions
Update frontend and backend TypeScript interfaces to support the request type classification.

*   **Files to Modify**:
    *   [types/pr1.ts](file:///c:/Users/Rovick/Desktop/project/types/pr1.ts) — Add `PR1RequestType` enum/union type and append `request_type` to `PR1Request` and `PR1FormValues`.
    *   [types/approvals.ts](file:///c:/Users/Rovick/Desktop/project/types/approvals.ts) — Append `request_type` to the `PR1ApprovalDetail` type definition.

---

### Phase 3: PR1 Creation Form & API Integration
Incorporate the request type picker in the creation form and propagate it to draft/submit database payloads.

*   **Files to Modify**:
    *   [lib/pr1.ts](file:///c:/Users/Rovick/Desktop/project/lib/pr1.ts) — Modify `saveDraftPR1` to map and persist `request_type` (defaulting to `'goods'`).
    *   [components/pr1/PR1Form.tsx](file:///c:/Users/Rovick/Desktop/project/components/pr1/PR1Form.tsx) — Add a toggle or segmented control for Request Type selection at the top of the form (locked once draft is submitted).
        *   If request type is `'services'`:
            *   Disable and display `N/A` for `Stock-on-Hand` on the row items grid.
            *   Hide the `is_raw_material` checkbox/column (services are not raw materials).

---

### Phase 4: Dashboard Filtering & Queues
Render the request type badge and add search filters to main lists.

*   **Files to Modify**:
    *   [lib/warehouse.ts](file:///c:/Users/Rovick/Desktop/project/lib/warehouse.ts) — Add `request_type` to `WAREHOUSE_QUEUE_SELECT` and mapping functions.
    *   [app/pr1/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/pr1/page.tsx) — Add request type filters to `FilterBar` and display request type badges (`Goods` as blue, `Services` as purple) on row records.
    *   [app/approvals/pr1/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/pr1/page.tsx) — Query and filter queue by `request_type` and render the badge.
    *   [app/warehouse/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/warehouse/page.tsx) — Display the badge and add filtering support on the Warehouse Validation Queue.

---

### Phase 5: Request Details & Signatories Display
Display request type metadata and handle SOH values on details/print layouts.

*   **Files to Modify**:
    *   [lib/approvals.ts](file:///c:/Users/Rovick/Desktop/project/lib/approvals.ts) — Query `request_type` from `pr1_requests` and append it to `PR1ApprovalDetail`.
    *   [app/pr1/\[id\]/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/pr1/[id]/page.tsx) — Render request type field in the summary header. For services requests, display `N/A` for `SOH` cells.
    *   [app/pr1/\[id\]/print/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/pr1/[id]/print/page.tsx) — Support `N/A` for `SOH` and classification badges on print templates.
    *   [app/approvals/\[id\]/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/[id]/page.tsx) — Render `N/A` for `SOH` in the items list for services requests.

---

### Phase 6: Warehouse Stock Validation Screen
Streamline the stock-check interface for warehouse validators when handling service requests.

*   **Files to Modify**:
    *   [app/warehouse/\[id\]/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/warehouse/[id]/page.tsx) — If `pr1.request_type === 'services'`:
        *   In `buildFormValues`, set `validated_soh = 0` for all item items.
        *   Disable verified SOH inputs and render `N/A`.
        *   Render `N/A` for Req SOH and display the outcome as `Procurement` (representing 100% outsourcing) directly.
        *   Allow validators to write remarks and approve validation immediately.

---

## Verification Plan

### Automated Verification
*   Execute `npm run build` to confirm compiling and lint checks succeed.

### Manual Verification
1.  **Creation**: Create a draft PR1 as an Employee, toggle `Request Type` to **Services**, and verify that the `is_raw_material` column hides and `SOH` displays `N/A`. Save progress and confirm draft records carry `request_type = 'services'`.
2.  **Approvals**: Route the Service request to Supervisor/Dept Head. Verify the approval queue displays the **Service** badge and details display `N/A` for SOH. Approve.
3.  **Warehouse Validation**: Open the request from the Warehouse Queue. Confirm `SOH` inputs are disabled and locked to `N/A` (submitting validation registers `0` stock, correctly requesting procurement canvassing for 100% of the service). Validate.
4.  **Completion**: Advance request downstream and generate the GRN. Verify that completion succeeds identically to Goods requests.
