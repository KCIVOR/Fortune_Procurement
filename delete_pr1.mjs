import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim();
});

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
);

async function deletePR1() {
  const pr1Id = 'e951404e-59b2-410a-a844-13bfabe49aa1';
  console.log(`Deleting PR1 ${pr1Id} (PR1-2026-0004) and all its associated data...`);

  // 1. Delete any approval instances for PR1
  console.log('- Deleting PR1 approval instances...');
  await supabase.from('approval_instances').delete().eq('document_id', pr1Id);

  // 2. Delete PR1 items
  console.log('- Deleting PR1 items...');
  await supabase.from('pr1_items').delete().eq('pr1_id', pr1Id);

  // 3. Delete PR1 request
  console.log('- Deleting PR1 record...');
  await supabase.from('pr1_requests').delete().eq('id', pr1Id);

  console.log('Done! The request has been completely removed.');
}

deletePR1();
