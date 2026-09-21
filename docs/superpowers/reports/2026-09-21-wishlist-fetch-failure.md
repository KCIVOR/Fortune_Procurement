# Wishlist Fetch Failure Diagnostic Report

## Finding

The Wishlist page is failing because the remote Supabase project does not expose the `public.wishlist_items` relation yet. The attached browser capture shows the request to:

`GET https://emddvbocupvufzvhcacz.supabase.co/rest/v1/wishlist_items?select=...`

returning **404 Not Found**.

## Request trace

1. `app/wishlist/page.tsx` loads the regular-user list with `listMyWishlistItems()`.
2. `lib/wishlist.ts` issues `db.from('wishlist_items').select('*')`.
3. Supabase PostgREST returns 404 before any wishlist row can be read.
4. The data helper converts the failure into `Failed to load your wishlist.`, which appears as the toast in the screenshot.

## Root cause

The repository contains the schema migration at `supabase/migrations/20260921120000_wishlist.sql`, including the table, indexes, RLS policies, and owner/admin constraints. That migration has not been applied to the Supabase project used by the running app, or its PostgREST schema cache has not been refreshed after application.

This is a deployment/schema-state issue. It is not caused by the Wishlist page layout, the header link, or the user’s approver role.

## Why this is not an access-denied problem

- The page and authenticated profile load successfully, so the app session and route guard are working.
- An RLS denial would normally surface as an authorization error or an empty result, not a missing-relation 404.
- The failing URL names the exact missing relation: `wishlist_items`.

## Impact

- Regular users cannot load or submit wishlist entries because every read/write targets the missing table.
- Admin queue loading will fail for the same reason after an admin opens `/wishlist`.
- Existing procurement, approval, bug-tracking, and messaging tables are not involved in this failure.

## Required remediation

Apply `20260921120000_wishlist.sql` to the same Supabase project referenced by `NEXT_PUBLIC_SUPABASE_URL`, then refresh/reload the PostgREST schema if the provider requires it. Verify the table exists in `public`, RLS is enabled, and the policies are present before retesting the page with a regular user and an admin.

## Verification status

Repository-side route, data-access, page, RLS assertion, TypeScript, and lint checks pass. Live SQL verification was not possible from this environment because the local Supabase Docker service is not running; the browser 404 is the direct evidence of the remote schema mismatch.
