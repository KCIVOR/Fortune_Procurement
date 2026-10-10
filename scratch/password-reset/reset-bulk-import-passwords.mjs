// Resets the password for the 57 accounts that succeeded in the
// 2026-09-16 04:21 UTC bulk import batch (audit_logs id 7da221af-...).
// Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env.
//
// Usage:
//   node reset-bulk-import-passwords.mjs            # dry run, no changes
//   node reset-bulk-import-passwords.mjs --apply    # actually reset passwords

import { createClient } from '@supabase/supabase-js';

const NEW_PASSWORD = 'Fortune2026!'; // shared temp password

const EMAILS = [
  'airine.edianel@fortunepackaging.com',
  'alex.terrones@fortunepackaging.com',
  'analyn.ilagan@fortunepackaging.com',
  'andrew.anastacio@fortunepackaging.com',
  'apimportation@fortunepackaging.com',
  'arjay.nebres@printwell.com.ph',
  'benjamin.yam@fortunepackaging.com',
  'bernard.avilla@fortunepackaging.com',
  'fpc_hrma@fortunepackaging.com',
  'dexter.bariso@fortunepackaging.com',
  'edgardo.bautista@fortunepackaging.com',
  'ellamay.ubaldo@fortunepackaging.com',
  'ericson.martinez@fortunepackaging.com',
  'euclid.mondejar@fortunepackaging.com',
  'evelyn.gillego@fortunepackaging.com',
  'fpc_accounting@fortunepackaging.com',
  'accountspayable@fortunepackaging.com',
  'accountsreceivable@fortunepackaging.com',
  'fpc.dcc@fortunepackaging.com',
  'digital@fortunepackaging.com',
  'fpc.engineering@fortunepackaging.com',
  'fpc_esh@fortunepackaging.com',
  'fpc.prepress@fortunepackaging.com',
  'fpc.spc@fortunepackaging.com',
  'genevieve.roxas-chua@fortunepackaging.com',
  'grace.lazarte@fortunepackaging.com',
  'grace.magsino@fortunepackaging.com',
  'howard.yam@fortunepackaging.com',
  'iris.goce@fortunepackaging.com',
  'jimdominic.pabalate@fortunepackaging.com',
  'jofelyn.paalisbo@fortunepackaging.com',
  'cost.analyst@fortunepackaging.com',
  'cost.estimator@fortunepackaging.com',
  'laarni.rull@fortunepackaging.com',
  'cost_estimator@fortunepackaging.com',
  'leah.gemora@fortunepackaging.com',
  'dinah.amor@fortunepackaging.com',
  'marcial.amaro@fortunepackaging.com',
  'marcial.amaro@printwell.com.ph',
  'mariagilina.villamor@fortunepackaging.com',
  'fpc_training@fortunepackaging.com',
  'marthy.mercado@fortunepackaging.com',
  'materials.fgw@fortunepackaging.com',
  'fpc_recruitment@fortunepackaging.com',
  'micka.malacapo@fortunepackaging.com',
  'pincky.trajano@fortunepackaging.com',
  'rebecca.gabion@fortunepackaging.com',
  'renielle.cunanan@fortunepackaging.com',
  'romeo.llona@fortunepackaging.com',
  'ronaldo.capinpin@fortunepackaging.com',
  'rosemarie.sison@fortunepackaging.com',
  'ryan.yam@fortunepackaging.com',
  'sgc_planning@fortunepackaging.com',
  'sherlyn.maling@fortunepackaging.com',
  'technical.support@fortunepackaging.com',
  'tiburcio.estioko@fortunepackaging.com',
  'valerie.pabalinas@fortunepackaging.com',
];

const apply = process.argv.includes('--apply');

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function findUserIdByEmail(email) {
  // listUsers doesn't support server-side email filter reliably across versions,
  // so page through and match. Fine at this scale (57 emails, small user base).
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page++;
  }
}

async function main() {
  console.log(`Mode: ${apply ? 'APPLY (will change passwords)' : 'DRY RUN (no changes)'}`);
  console.log(`Target accounts: ${EMAILS.length}`);
  console.log('');

  let ok = 0, notFound = 0, failed = 0;

  for (const email of EMAILS) {
    const userId = await findUserIdByEmail(email);
    if (!userId) {
      console.log(`[NOT FOUND] ${email}`);
      notFound++;
      continue;
    }

    if (!apply) {
      console.log(`[WOULD RESET] ${email} (id ${userId})`);
      ok++;
      continue;
    }

    const { error } = await admin.auth.admin.updateUserById(userId, { password: NEW_PASSWORD });
    if (error) {
      console.log(`[FAILED] ${email}: ${error.message}`);
      failed++;
    } else {
      console.log(`[RESET OK] ${email}`);
      ok++;
    }
  }

  console.log('');
  console.log(`Done. ok=${ok} notFound=${notFound} failed=${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
