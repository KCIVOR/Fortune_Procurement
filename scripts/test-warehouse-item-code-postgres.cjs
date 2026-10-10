// Current-behavior runner: deployed baseline THEN unpublished direct-edit fix.
// The historical override runner remains test-warehouse-item-code-legacy-postgres.cjs.
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const result = spawnSync(process.execPath, [resolve('scripts/test-warehouse-item-code-direct-migration.cjs'), ...process.argv.slice(2)], {
  stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
