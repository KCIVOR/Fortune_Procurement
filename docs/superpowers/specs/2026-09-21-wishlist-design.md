# Wishlist design

## Goal

Give every authenticated application user a small, low-risk place to submit and track ideas for improvements after soft launch. Regular users can create, read, edit, and delete their own entries while they are still open. Administrators can read every entry and manage its workflow status and admin notes.

## Recommended MVP boundary

The first version stores a title, description, optional category, status, admin notes, creator, and timestamps. It does not add voting, comments, attachments, email notifications, public sharing, or links to procurement records. Those are separate follow-up features and would add new RLS and moderation surfaces.

Statuses are `open`, `planned`, `in_progress`, `completed`, and `declined`. New entries start as `open`; only admins may change status or admin notes. A user may edit or delete their own entry only while it is `open`.

## Access and data flow

The `/wishlist` route is authenticated for every `AppRole`, including suppliers and TSQA. The sidebar gets a Wishlist item for every role. The page branches from the loaded profile: a regular user sees a form and their own entries; an admin sees all entries, filters/search, and status/note controls. Supabase RLS is the security boundary: authenticated users insert as themselves and select/update/delete only their own open rows; admins select and update all rows. The browser data-access module still validates user identity and allowed transitions before issuing writes.

The feature uses a dedicated `wishlist_items` table and migration. It does not modify existing procurement tables, approval workflows, audit semantics, or module-visibility data. Admin status changes can write a normal `audit_logs` record only if the existing audit contract supports a generic feature event without changing that table; otherwise the first version relies on `updated_at` and the row's `updated_by` field.

## UI approach

Reuse existing `AppShell`, `PageHeader`, `FilterBar`, `EmptyState`, status chips, toast, loading, and error patterns. Keep the user form on the page with a small modal or inline panel and use the same page for the admin dashboard to avoid a second route and duplicate fetch logic. Add accessible labels, character limits, optimistic-free refresh after writes, and clear empty/error states.

## Constraints

- No changes to PR1/PR2/RFQ/PO/Delivery/GRN schemas or queries.
- No broadening of any existing route; add only `/wishlist`.
- No trust in client-only admin checks; duplicate every permission in RLS and write helpers.
- Do not expose another user's description or admin notes to regular users.
- Do not add notifications, realtime subscriptions, file uploads, votes, comments, or external integrations in the MVP.
- Preserve current dirty working-tree changes and avoid formatting unrelated files.

## Verification

Test the route matrix for every `AppRole`, RLS policy intent for user/admin/read/write/delete cases, status transition restrictions, and navigation presence. Run focused unit/data-access tests, TypeScript, targeted lint, and a browser smoke test with one regular user and one admin. Confirm a direct `/wishlist` visit works even if a module-visibility row is absent.
