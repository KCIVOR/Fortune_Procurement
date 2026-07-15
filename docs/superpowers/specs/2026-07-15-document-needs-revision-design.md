# Document Needs Revision + Replace — Design

**Date:** 2026-07-15  
**Status:** Approved for implementation (user 2026-07-15) — implemented on `feat/accreditation-document-expiry`
**Parent:** Path B document-level accreditation verification (`docs/superpowers/plans/2026-07-15-accreditation-documents-expiry-surgical.md`)

---

## Goal

Procurement can flag a **single accreditation document** as needing revision, with **remarks**. The supplier **replaces that same document row** (new file). Application status does **not** change.

---

## Decisions locked

| ID | Decision | Choice |
|----|----------|--------|
| R1 | Application status when doc needs revision | **Unchanged** |
| R2 | Supplier fix method | **Replace same row** (overwrite file, clear remarks, back to Pending) |
| R3 | Storage model | Approach 1: new status `needs_revision` + column `revision_note` |
| R4 | Allowed while application Approved | **Yes** (same window as verify today) |
| R5 | RFQ / canvassing | **Unchanged** (still application `approved` only) |
| R6 | Product / RSE documents | **Out of scope** |

---

## Behavior

### Procurement — request revision

1. On an accreditation application document (`accreditation_id` set, `supplier_product_id` null).
2. Allowed when application is `submitted` | `under_review` | `missing_documents` | `approved`.
3. Allowed from document status `uploaded` (Pending) or `accepted` (Verified).
4. Action: **Needs revision** + **required remarks**.
5. Result:
   - `status` → `needs_revision`
   - `revision_note` → remarks
   - `expires_at` → `null`
6. Application row unchanged.
7. Audit: `ACCREDITATION_DOCUMENT_NEEDS_REVISION`.

### Supplier — replace file

1. Sees document as **Needs revision** and the remarks (read-only).
2. Uploads a replacement file for **that document id** only when status is `needs_revision`.
3. Result on **same row**:
   - New `file_path` / `file_name` / mime / size
   - `status` → `uploaded` (Pending)
   - `revision_note` → `null`
   - `expires_at` stays `null`
4. Old storage object: best-effort delete after successful new upload (avoid orphans); failure to delete is non-blocking.
5. Audit: `ACCREDITATION_DOCUMENT_RESUBMITTED`.
6. No application status change; no required “Submit for review” for this path.

### Procurement — after replace

1. Document shows **Pending** again.
2. Can Verify / Reject / Needs revision as before.

### Reject (unchanged meaning)

- **Reject** remains a separate final-ish state (`rejected`): no replace flow required.
- Needs revision is the fixable path.

---

## Data

### Migration

1. Add nullable `revision_note text` on `supplier_documents`.
2. Extend status CHECK to include `needs_revision`:
   - `'uploaded' | 'accepted' | 'rejected' | 'expired' | 'needs_revision'`
3. Do **not** rename existing values.
4. Shared table: product/RSE rows never use `needs_revision` in app code (guards stay accreditation-only).

### Types

- Update `types/database.ts` status union + `revision_note`.

---

## UI

### Procurement detail (`app/accreditation/[id]/page.tsx`)

- Document row: chip **Needs revision**.
- Button **Needs revision** (with remarks required) alongside Verify / Reject when manageable.
- Show `revision_note` when present.

### Supplier portal (`app/supplier/accreditation/page.tsx`)

- Show **Needs revision** + remarks.
- For that row only: file picker / Replace upload (not a brand-new document insert).
- Keep existing “upload new document” for normal adds when upload is allowed.

### Queue / RFQ

- No change required for v1.

---

## Notifications

- **v1:** optional / out of scope (procurement notices replace by opening the application).
- Application-level **Request Missing Docs** remains available as a separate whole-app path.

---

## Out of scope

- Flipping application to `missing_documents`
- Emails / approaching-expiry
- OCR
- Product/RSE needs-revision
- Keeping prior file versions on the same row (overwrite only; audit text only)

---

## Risks accepted

1. Application can stay **Approved** while a document is Needs revision / Pending again.
2. Prior file bytes are not retained on the row after replace.
3. Two fix paths coexist: per-doc Needs revision vs app-level Request Missing Docs.

---

## Success criteria

- [ ] Procurement can flag Needs revision with remarks without changing application status.
- [ ] Supplier can replace that row and it returns to Pending with remarks cleared.
- [ ] Product/RSE docs unaffected.
- [ ] `tsc --noEmit` clean; RLS still allows supplier update only via the intended replace path (may need a narrow supplier UPDATE policy if none exists today — verify before coding).
