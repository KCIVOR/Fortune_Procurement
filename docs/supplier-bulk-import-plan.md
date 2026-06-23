# Supplier Bulk Import — Implementation Plan

This document outlines the step-by-step plan for implementing the **Supplier Bulk Import** feature in Fortune Procurement. The feature will allow procurement users to upload a CSV or Excel file containing supplier information (email, company name, default payment terms) and create multiple user accounts at once using a single, user-defined temporary password.

---

## Technical Scope & Rules
*   **Template Structure (Strict)**: CSV/Excel file with headers: `email`, `full_name`, `payment_terms`.
*   **Authentication**: Procurement user provides a shared password for all suppliers in the uploaded batch.
*   **Row-Level Resilience**: Processing does not fail the whole batch on a duplicate email or constraint issue. Failed rows are skipped, and the report details successes vs. failures per row.
*   **Additive Only**: No changes will be made to the existing single-supplier creation route (`/api/procurement/suppliers/create`) or `CreateSupplierModal.tsx`.
*   **Reuse Existing Helpers**: We will reuse `resolveSupplierDefaults` from [procurement-supplier-defaults.ts](file:///c:/Users/Rovick/Desktop/project/lib/procurement-supplier-defaults.ts) without altering its logic.

---

## Sequential Phases

### Phase 1: Dependencies & Client-Side File Parsing
Install parsing libraries and build a helper to extract structured JSON data from either CSV or Excel file inputs.

*   **Files to Modify**:
    *   [package.json](file:///c:/Users/Rovick/Desktop/project/package.json) — Add `"papaparse"` (CSV parser), `"xlsx"` (Excel/Spreadsheet parser), and their corresponding `@types/` packages.
*   **Files to Create**:
    *   `lib/supplier-import-parser.ts` [NEW] — Client-side parser helper that wraps `papaparse` and `xlsx`. It accepts a `File` object, parses it, validates that the required headers (`email`, `full_name`) are present, parses `payment_terms` as optional text, and outputs a sanitized array of rows: `{ email: string; full_name: string; payment_terms?: string }[]`.
*   **Verification / Validation Step**:
    *   Run `npm install` and verify the project builds cleanly.
    *   Confirm the existing manual single-supplier creation modal still opens and works in the UI.

---

### Phase 2: Bulk Import API Route
Create the backend handler that receives the batch payload, performs validation, and loops through rows with transaction rollback logic per-supplier.

*   **Files to Create**:
    *   `app/api/procurement/suppliers/bulk-import/route.ts` [NEW] — Backend endpoint (`POST`) for importing supplier batches.
        *   **Authorization**: Reuses the exact pattern from `app/api/procurement/suppliers/create/route.ts` by calling `requireApiAuth(req, ['procurement', 'admin'])` imported from `lib/api-auth.ts`.
        *   **Defaults Resolution**: Reuses `resolveSupplierDefaults` from [procurement-supplier-defaults.ts](file:///c:/Users/Rovick/Desktop/project/lib/procurement-supplier-defaults.ts) to retrieve active IDs for the `'supplier'` role, `'Supplier Representative'` position, and `'GS'` department.
        *   **Shared Password**: Accepts `password` (minimum 8 characters) to be set for all imported accounts.
        *   **Loop Processing**: Loops through parsed rows. For each row:
            1.  Normalizes email and checks syntax. If invalid, logs a row failure: `"Invalid email format"`.
            2.  Attempts `admin.auth.admin.createUser({ email, password, email_confirm: true })`. If Supabase Auth fails, detects duplicate status by checking if the error message contains any of the target keywords (`"already"`, `"exists"`, `"registered"`, or `"duplicate"`), and logs a consistent row failure: `"A user with this email already exists."`
            3.  Inserts the profile record into the `profiles` table.
            4.  **Rollback**: If profile insertion fails, deletes the created auth user via `admin.auth.admin.deleteUser(userId)` and logs row failure: `"Profile creation failed"`.
            5.  If both succeed, increments success count.
        *   **Audit Logging**: Inserts an audit log record with the action `'SUPPLIER_BULK_IMPORTED'`. Confirmed `action` column is a free-text field with no check constraints or enums restricting this value.
        *   **Response**: Returns `{ success: true, summary: { total: number; succeeded: number; failed: number }, details: { email: string; full_name: string; status: 'success' | 'failed'; error?: string }[] }`.
*   **Verification / Validation Step**:
    *   Test route using mock payloads in a scratch script (e.g. in the `scratch/` folder).
    *   Verify the database state: confirm auth accounts and profiles are correctly linked for successful rows, and rollback removes auth accounts on profile failure.
    *   Confirm that the single-supplier create endpoint (`/api/procurement/suppliers/create`) remains completely unmodified and functional.

---

### Phase 3: Bulk Import Modal Component
Create the frontend modal interface allowing files to be dragged/dropped, shared passwords to be configured, and validation results to be shown.

*   **Files to Create**:
    *   `components/procurement/BulkImportSupplierModal.tsx` [NEW] — Modular dialog component:
        *   **Upload Panel**: Supports file drag-and-drop/selection, accepting only `.csv`, `.xls`, and `.xlsx` extensions. Shows a download link for a CSV template.
        *   **Shared Password Field**: Input with visibility toggle (eye icon) and auto-generation helper. Enforces minimum 8 characters.
        *   **Results Panel**: Visual report rendered after upload. Displays summary statistics (Total, Successes, Failures) and lists each row's status with descriptive error notes for skipped rows.
*   **Verification / Validation Step**:
    *   Write a unit test or view the component in isolation to ensure layout, drag-and-drop state, password fields, and validation states render correctly.
    *   Ensure the existing [CreateSupplierModal.tsx](file:///c:/Users/Rovick/Desktop/project/components/procurement/CreateSupplierModal.tsx) file is not modified.

---

### Phase 4: Page Integration
Expose the bulk import action in the supplier management workspace.

*   **Files to Modify**:
    *   [app/suppliers/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/suppliers/page.tsx) — Add a "Bulk Import" button adjacent to the "Add Supplier" button. Wire it to open the new `BulkImportSupplierModal`.
*   **Verification / Validation Step**:
    *   Confirm the "Bulk Import" button is only visible to roles with permission (Procurement and Admin).
    *   Click the "Add Supplier" button and verify it still launches the single-creation `CreateSupplierModal` which completes successfully.
    *   Click the "Bulk Import" button and verify it launches the import modal.

---

### Phase 5: Testing & Audit Validation
Verify the end-to-end user flow, handling of edge cases, and compliance with the existing audit layout.

*   **Verification Tasks**:
    *   Test file parsing failures (e.g., uploading an empty file, missing headers, or corrupt files) and verify correct error UI alerts are displayed.
    *   Test batch creation with a mix of new emails and duplicate emails. Verify that the new users are created, duplicates are skipped without interrupting the process, and the summary detail lists reasons.
    *   Inspect `audit_logs` in the database to verify `SUPPLIER_BULK_IMPORTED` payload entries match the actor, timestamp, and details of the imported users.

---

## Pre-Implementation Review Checklist
- [ ] No changes proposed to `CreateSupplierModal.tsx`.
- [ ] Single supplier API creation route (`/api/procurement/suppliers/create/route.ts`) remains untouched.
- [ ] The `resolveSupplierDefaults` helper is referenced cleanly and not modified.
- [ ] Row rollback logic cleanly cleans up `auth.users` records if the `profiles` insert fails in the loop.
- [ ] Clear separation of CSV/Excel parsing helpers in a new `lib/` file to isolate library imports.
