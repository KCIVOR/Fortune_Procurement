# Implementation Plan - Procurement Feature Revisions

This implementation plan details the phased roll-out of the Procurement System feature revisions. As requested, **Phases 1 and 2 are completed**, **Phases 3 and 4 are deferred for now**, and we are proceeding directly to **Phase 5 (PR1 Attachments)** with support for **multiple image uploads**.

---

## User Review Required

> [!IMPORTANT]
> **Multiple Attachment Schema:** Instead of storing a single path on `pr1_requests`, we will create a dedicated `pr1_attachments` table. This allows employees to upload and manage multiple images for a single PR1.
>
> **Private Storage & Security:** We will configure a private Supabase storage bucket `pr1-attachments` with strict RLS policies. Access to view/download attachments is restricted to users authorized to read the corresponding PR1 using the existing security definer helper `public.can_read_pr1(pr1_id)`.
>
> **Allowed Formats:** We will restrict uploads to images (`image/jpeg`, `image/png`, `image/gif`, `image/webp`) with a size limit of 10 MB per file.

## Open Questions

- *Do we want to render attachments in the printed version of the PR1 request?* (We plan to list the file names in a text list on the print page, rather than embedding the full-resolution images).

---

## Completed Phases

### Phase 1: Raw Material TSQA Notice (Feature 9)
- **Status: Completed**
- **Changes:** Added warning banner in `/grn/[id]/page.tsx` for closed raw material receipts.

### Phase 2: Procurement Manager Permissions (Feature 7)
- **Status: Completed**
- **Changes:** Updated approvals libraries (`lib/approvals.ts`, `lib/pr2-approvals.ts`, `lib/po-approvals.ts`) to grant `Procurement Manager` step authority for tasks requiring `Procurement Staff`.

---

## Active Phase: Phase 5 - PR1 Attachments (Feature 1)
*Complexity: Medium (Storage, database linking, multiple file state management, and page displays)*

Add multiple image upload capabilities to PR1 requests, showing them on detail, approval, and warehouse verification screens.

### Proposed Changes

#### 1. Database Schema
- **[NEW] [20260618000300_pr1_attachments.sql](file:///c:/Users/Rovick/Desktop/project/supabase/migrations/20260618000300_pr1_attachments.sql)**
  - Create table `pr1_attachments` with columns:
    - `id` (uuid primary key, default `gen_random_uuid()`)
    - `pr1_id` (uuid referencing `pr1_requests(id) ON DELETE CASCADE`)
    - `file_name` (text, non-empty check)
    - `file_path` (text, unique)
    - `file_size` (bigint, positive check)
    - `mime_type` (text)
    - `uploaded_by` (uuid referencing `profiles(id)`)
    - `created_at` (timestamptz default `now()`)
  - Enable RLS on `pr1_attachments` table:
    - **SELECT**: `TO authenticated USING (public.can_read_pr1(pr1_id))`
    - **INSERT/DELETE**: `TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM pr1_requests pr WHERE pr.id = pr1_id AND pr.requisitioner_id = auth.uid() AND pr.status = 'draft'))` (and `uploaded_by = auth.uid()`)
  - Create storage bucket `'pr1-attachments'` (private, 10MB limit, allowed mimes: `'image/jpeg', 'image/png', 'image/gif', 'image/webp'`).
  - Create storage policies for `'pr1-attachments'` bucket:
    - **INSERT**: Authenticated users can upload to path `pr1/{pr1_id}/{filename}` if the PR1 exists, belongs to them, and is in `draft` status.
    - **SELECT**: Authenticated users can read/download from path `pr1/{pr1_id}/{filename}` if `public.can_read_pr1(pr1_id)` is true.
    - **DELETE**: Authenticated users can delete from path `pr1/{pr1_id}/{filename}` if they own the PR1 and it is in `draft` status.

#### 2. Type Configurations
- **[MODIFY] [database.ts](file:///c:/Users/Rovick/Desktop/project/types/database.ts)**
  - Add type definition for `pr1_attachments` table.
- **[MODIFY] [pr1.ts](file:///c:/Users/Rovick/Desktop/project/types/pr1.ts)**
  - Add `PR1Attachment` interface.
  - Enrich `PR1WithItems` interface with `attachments?: PR1Attachment[]`.

#### 3. Core Logic & Helpers
- **[NEW] [pr1-attachments.ts](file:///c:/Users/Rovick/Desktop/project/lib/pr1-attachments.ts)**
  - Add utility functions:
    - `uploadPR1Attachment(pr1Id, file, profile)`: Upload file to storage and insert metadata record in `pr1_attachments`.
    - `deletePR1Attachment(attachmentId, filePath)`: Remove metadata record and delete from storage.
    - `getPR1AttachmentSignedUrl(filePath)`: Create signed URL with a 5-minute TTL.
- **[MODIFY] [pr1.ts](file:///c:/Users/Rovick/Desktop/project/lib/pr1.ts)**
  - Update `fetchPR1ById` to include `pr1_attachments(*)` in the main select query and attach the result array to the returned object.

#### 4. Frontend & User Interface Pages
- **[MODIFY] [PR1Form.tsx](file:///c:/Users/Rovick/Desktop/project/components/pr1/PR1Form.tsx)**
  - Add drag-and-drop or file-picker section restricting selections to images.
  - Track `existingAttachments`, `filesToUpload` (storing raw `File` objects), and `attachmentsToDelete` in state.
  - Update `handleSaveDraft` and `handleSubmit` to:
    1. Save/submit the PR1 header and items to get the `pr1Id`.
    2. Loop through `attachmentsToDelete` and call deletion helpers.
    3. Loop through `filesToUpload`, uploading each file under the resolved `pr1Id` folder, inserting database rows.
    4. Proceed with router redirect once all uploads complete.
- **[MODIFY] [page.tsx](file:///c:/Users/Rovick/Desktop/project/app/pr1/[id]/page.tsx)** (Requisitioner View)
  - Fetch signed URLs for all attachments on page load.
  - Render a responsive thumbnails gallery. Clicking a thumbnail opens the image in a lightbox modal or new tab.
- **[MODIFY] [page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/[id]/page.tsx)** (Approver View)
  - Load signed URLs and display the attachments gallery card right below the Request Details card.
- **[MODIFY] [page.tsx](file:///c:/Users/Rovick/Desktop/project/app/warehouse/[id]/page.tsx)** (Warehouse View)
  - Load signed URLs and display the attachments gallery card to assist warehouse validators in reviewing requested items.
- **[MODIFY] [page.tsx](file:///c:/Users/Rovick/Desktop/project/app/pr1/[id]/print/page.tsx)** (Print Layout)
  - If attachments exist, render a small "Attachments:" text list showing the filenames.

---

## Verification Plan

### Automated Verification
- Run typescript compilation (`npx tsc --noEmit`) to verify types.

### Manual Verification Steps
1. **Creation Flow:** Open a new PR1. Choose 2 images. Save as draft. Check Supabase storage to confirm files are stored under path `pr1/{pr1_id}/...` and listed in table `pr1_attachments`.
2. **Edit Flow:** Edit the draft PR1. Delete 1 image and upload a new one. Save draft. Confirm that the deleted image is removed from both storage and the database table.
3. **Visibility Audit:**
   - Log in as the requisitioner: verify both images are visible on the PR1 detail page.
   - Log in as the Supervisor (approver): verify both images display on the PR1 approval page.
   - Log in as Warehouse Staff: verify both images show up on the warehouse validation screen.
4. **Access Protection:** Log in as another employee. Try accessing a signed URL for the attachment. Confirm access is denied (private URL expires/requires permissions).
