const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.resolve(__dirname, '..', 'supabase/migrations/20260921120000_wishlist.sql'), 'utf8');

test('wishlist migration enables owner/admin RLS boundaries', () => {
  assert.match(sql, /ALTER TABLE public\.wishlist_items ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /user_id = auth\.uid\(\)/);
  assert.match(sql, /status = 'open'/);
  assert.match(sql, /admin_notes IS NULL/);
  assert.match(sql, /public\.is_wishlist_admin\(\)/);
  assert.match(sql, /CREATE POLICY "Owners can update open wishlist items"/);
  assert.match(sql, /CREATE POLICY "Admins can update all wishlist items"/);
  assert.match(sql, /CREATE POLICY "Owners can delete open wishlist items"/);
  assert.match(sql, /guard_wishlist_owner_fields/);
});

test('wishlist migration constrains fields and workflow statuses', () => {
  assert.match(sql, /length\(title\) <= 160/);
  assert.match(sql, /length\(description\) <= 4000/);
  assert.match(sql, /status IN \('open', 'planned', 'in_progress', 'completed', 'declined'\)/);
});
