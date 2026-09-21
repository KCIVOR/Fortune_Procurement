const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = path.resolve(__dirname, '..', 'app', 'wishlist', 'page.tsx');
const source = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';

test('wishlist page exposes the regular-user submission and ownership controls', () => {
  assert.match(source, /createWishlistItem/);
  assert.match(source, /listMyWishlistItems/);
  assert.match(source, /updateWishlistItem/);
  assert.match(source, /deleteWishlistItem/);
  assert.match(source, /Only open ideas can be edited/);
});

test('wishlist page exposes the admin queue and workflow controls', () => {
  assert.match(source, /listAllWishlistItems/);
  assert.match(source, /adminUpdateWishlistItem/);
  assert.match(source, /Search wishes/);
  assert.match(source, /in_progress/);
});
