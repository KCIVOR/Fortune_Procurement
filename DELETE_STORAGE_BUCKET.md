# Delete Message Attachments Storage Bucket

The `message-attachments` storage bucket still exists in your Supabase project and needs to be deleted manually.

## Option 1: Delete via Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/qvxrvnsjlycdgvhwgtkj/storage/buckets
2. Find the `message-attachments` bucket
3. Click the three dots (⋮) menu
4. Select "Delete bucket"
5. Confirm deletion

## Option 2: Delete via SQL (Workaround)

Run this SQL in the Supabase SQL Editor:

```sql
-- First, ensure no objects exist in the bucket
DELETE FROM storage.objects WHERE bucket_id = 'message-attachments';

-- Then delete the bucket using the storage schema's internal function
-- This bypasses the protection trigger
ALTER TABLE storage.buckets DISABLE TRIGGER protect_delete;
DELETE FROM storage.buckets WHERE id = 'message-attachments';
ALTER TABLE storage.buckets ENABLE TRIGGER protect_delete;
```

## Option 3: Delete via Supabase CLI

If you have Supabase CLI installed:

```bash
# List buckets to confirm it exists
supabase storage list

# Delete the bucket
supabase storage rm message-attachments --recursive
```

## Verification

After deletion, verify it's gone by running:

```sql
SELECT id, name FROM storage.buckets WHERE id = 'message-attachments';
```

Should return 0 rows.

---

**Status:** The bucket is currently empty (0 files), so deletion is safe.
