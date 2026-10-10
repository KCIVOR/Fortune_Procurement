// Validates that every account in the 2026-09-16 bulk-import batch can
// sign in with the new shared password. Uses the anon key + signInWithPassword
// (real auth flow, same as the login page), then signs out immediately.

import { createClient } from '@supabase/supabase-js';

const PASSWORD = 'Fortune2026!';

const EMAILS = [
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
  'ronaldo.capinpin@fortunepackaging.com',
  'rosemarie.sison@fortunepackaging.com',
  'ryan.yam@fortunepackaging.com',
  'sgc_planning@fortunepackaging.com',
  'sherlyn.maling@fortunepackaging.com',
  'technical.support@fortunepackaging.com',
  'tiburcio.estioko@fortunepackaging.com',
  'valerie.pabalinas@fortunepackaging.com',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  let ok = 0, failed = 0;
  const failures = [];

  for (const email of EMAILS) {
    // Fresh client per account so sessions never mix.
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let result = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (result.error?.message?.toLowerCase().includes('rate limit')) {
      await sleep(15000);
      result = await client.auth.signInWithPassword({ email, password: PASSWORD });
    }
    const { data, error } = result;

    if (error || !data.session) {
      console.log(`[LOGIN FAILED] ${email}: ${error?.message ?? 'no session returned'}`);
      failed++;
      failures.push(email);
      await sleep(3000);
      continue;
    }

    console.log(`[LOGIN OK] ${email}`);
    ok++;
    await client.auth.signOut();
    await sleep(3000);
  }

  console.log('');
  console.log(`Done. ok=${ok} failed=${failed} total=${EMAILS.length}`);
  if (failures.length) {
    console.log('Failures:', failures.join(', '));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
