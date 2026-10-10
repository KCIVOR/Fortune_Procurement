# Phase 2 verification — warehouse item-code helpers and RPC wrappers

Completed locally on 2026-10-10, directly on main as authorized. No commit, push, UI change, dependency change, or production migration deployment.

## Scope

- `lib/warehouse-item-code.ts`: dependency-free normalization, effective-code resolution, exact validation/item selection with BigInt ordering, persisted-response types and validation.
- `lib/warehouse-item-code-data.ts`: authenticated browser RPC read/save wrappers; no direct table writes. Errors propagate, saves require exactly one matching persisted row, reads reject duplicate or mismatched identities. A successful empty read remains valid for a validation with no lines; consumers must match required lines explicitly rather than assuming corrections are absent.
- `types/database.ts`: only the two feature RPC definitions and their type-only import.
- Pure tests plus `scripts/test-warehouse-item-code-data.cjs` (feature test allowlist extension). No new packages.

## Verification

1. Initial helper-test compilation failed because the implementation did not yet exist.
2. Standalone TypeScript compilation passed.
3. `node --test scratch/warehouse-item-code-tests/warehouse-item-code.test.js`: 4 passed, 0 failed.
4. `node --test scripts/test-warehouse-item-code-data.cjs`: 3 passed, 0 failed.
5. `npm run typecheck`: exit 0.
6. `git diff --check`: exit 0; existing LF/CRLF notices only.

Coverage includes original fallback, intentional blank, leading zeros/case/punctuation/internal spaces, ASCII-only surrounding-space normalization, immutable identity isolation, bigint text IDs beyond Number precision, missing/malformed responses, denied/stale RPC errors, duplicate/wrong identities, and returning persisted results rather than attempted input. RPC tests use a mocked transport, not production database or hosted Auth verification.

## Release boundary

Phase 3 (warehouse editor) is next. The feature migration remains undeployed; Phase 2 does not change that status. Full downstream compatibility, hosted/browser UAT, and release verification remain required. Existing unrelated workspace changes were preserved.
