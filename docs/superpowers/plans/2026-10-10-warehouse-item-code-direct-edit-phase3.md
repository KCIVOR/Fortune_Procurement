# Direct item-code fix — Phase 3 verification

October 10, 2026. Main. UI implementation complete locally; production release is not performed.

## Changes

- Warehouse table shows one current Code value with the existing Edit / Save / Cancel controls. Removed Requestor/Warehouse split labels and the separate-code banner. Error/retry and save status live inside Item Validation, not a permanent explanatory banner.
- Checked load/reload verifies immutable item/validation relationships and agreement between returned persisted codes. It no longer compares against stale React-held requester text.
- Successful checked save and reload merge only `item_code` into matching PR1, validation and draft-form items. Blank codes stay blank. No form rebuild/reopen or non-code field replacement occurs.
- Dirty quantity, SOH, override reason, line notes and overall notes survive save/reload. Attempted text survives conflicts/errors. An ambiguous save blocks submission until a checked reload. Cancel makes no save call; Enter saves; Escape cancels.
- Current PR2, decided validation, wrong lifecycle, inactive and non-warehouse restrictions remain. No environment switches.
- Removed unused correction-as-effective-code helpers. Read response validation now requires current PR1/effective code agreement. Audit metadata remains compatible but cannot become an operational override.

Production files changed in this phase only:
`app/warehouse/[id]/page.tsx`, `lib/warehouse-item-code.ts`, `lib/warehouse-item-code-data.ts`.

Tests changed: `lib/warehouse-item-code.test.ts`, `scripts/test-warehouse-item-code-data.cjs`, `scripts/test-warehouse-item-code-editor.cjs`.

No SQL/migration edits, database writes, dependencies, unrelated code cleanup, commits, pushes or deployment. Phase 2 migration SHA256 remains `47AB4B52E7BD435FB6ACE5084DA20E1CA6CFABC4DFE44B3B7A9EE70E184ABB56`.

## RED/GREEN evidence

- New direct-read agreement unit regression first failed with “Missing expected exception.”
- Updated browser expectations first produced five failing subtests (six failures including their parent): split labels/banner, stale initial code, concurrent-code reload, conflict retry and ambiguous-save recovery. The unchanged remaining eight subtests passed.
- Browser prerequisite failures were distinguished from feature failures: required production CSS was initially absent; a build generated it. Browser launch was sandbox-blocked; approved local headless execution then produced the genuine RED results. No production connection was used.
- After implementation, helper/RPC/consumer/remarks suite: **23 passed, 0 failed**, exit 0.
- Final browser suite after the completed production build: **15 passed, 0 failed**, exit 0 (14 subtests plus parent).

Browser coverage includes real React state observations for all three item copies, duplicate-code line-ID targeting, blank/formatted codes, dirty fields, role/status restrictions, narrow-screen long codes, keyboard actions, pending-save guards, read/save errors, stale initial responses, concurrent changes and committed-but-interrupted response recovery.

The actual requester PR1 detail and print components were also mounted with fresh synthetic PR1 reads after a warehouse save. Both displayed the corrected code. Their production source already reads `fetchPR1ById`/`pr1_items` and was not modified.

## Commands and results

```powershell
node node_modules/typescript/bin/tsc lib/warehouse-item-code.ts lib/warehouse-item-code.test.ts lib/warehouse-pr2-remarks.ts lib/warehouse-pr2-remarks.test.ts --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck --outDir scratch/warehouse-item-code-tests
node --test scratch/warehouse-item-code-tests/warehouse-item-code.test.js scratch/warehouse-item-code-tests/warehouse-pr2-remarks.test.js scripts/test-warehouse-item-code-data.cjs scripts/test-warehouse-item-code-consumers.cjs
node node_modules/eslint/bin/eslint.js lib/warehouse-item-code.ts lib/warehouse-item-code-data.ts 'app/warehouse/[id]/page.tsx'
npm run typecheck
npm run build
node --test scripts/test-warehouse-item-code-editor.cjs
git diff --check
git diff --exit-code -- package.json package-lock.json
```

All exited 0. Build warnings remain: outdated Browserslist data, Supabase realtime dynamic dependency, client-rendering deopts for `/po/new` and `/tsqa/grn`. Build configuration skips lint; focused ESLint was run separately and passed. No claim of clean project-wide lint is made. Diff check emitted existing CRLF conversion warnings for unrelated `.gitignore` / `scripts/build_manual.py`.

Visual inspection used the actual built CSS at 1280px and 390px. Code wraps, controls remain usable, and the table scrolls within its existing container. Reviewed screenshots: `scratch/warehouse-item-code-tests/editor-wide.png`, `editor-narrow.png`, `editor-conflict.png`.

## Limits / next phase

These are synthetic-transport browser checks of the real page components, not hosted JWT/end-to-end acceptance. Shared layout/access dependencies are isolated in the fixture; the requester-read test is not an authorization test. The database migration is still unpublished, so do not deploy/use this frontend against the old save implementation as a completed fix. Phase 4 full regression and Phase 5 coordinated release remain.

[Test-driven development](C:/Users/Rovick/.agents/skills/superpowers/test-driven-development/SKILL.md) drove the demonstrated RED/GREEN sequence and additional dirty-state regressions. [Verification-before-completion](C:/Users/Rovick/.agents/skills/superpowers/verification-before-completion/SKILL.md) required the final build/browser/type/lint evidence before declaring local completion. Supabase integration remains the already reviewed authenticated RPC boundary; no public secrets, grants or API signatures changed.
