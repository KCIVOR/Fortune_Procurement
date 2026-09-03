import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldReloadProfile, shouldReplaceSession } from './auth-state-update';

test('does not reload profile when the same user is already loaded (tab focus)', () => {
  assert.equal(
    shouldReloadProfile({
      incomingUserId: 'user-1',
      currentUserId: 'user-1',
      hasProfile: true,
    }),
    false,
  );
});

test('reloads profile when a session arrives before any profile is loaded', () => {
  assert.equal(
    shouldReloadProfile({
      incomingUserId: 'user-1',
      currentUserId: 'user-1',
      hasProfile: false,
    }),
    true,
  );
});

test('reloads profile when the signed-in user changes', () => {
  assert.equal(
    shouldReloadProfile({
      incomingUserId: 'user-2',
      currentUserId: 'user-1',
      hasProfile: true,
    }),
    true,
  );
});

test('does not reload profile when the session is cleared', () => {
  assert.equal(
    shouldReloadProfile({
      incomingUserId: null,
      currentUserId: 'user-1',
      hasProfile: true,
    }),
    false,
  );
});

test('does not replace session when the access token is unchanged', () => {
  assert.equal(shouldReplaceSession('token-a', 'token-a'), false);
});

test('replaces session when the access token rotates', () => {
  assert.equal(shouldReplaceSession('token-b', 'token-a'), true);
});
