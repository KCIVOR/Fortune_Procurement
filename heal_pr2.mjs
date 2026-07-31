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

async function heal() {
  const pr2Number = 'PR2-2026-0004';
  console.log(`Healing data for ${pr2Number}...`);

  const { data: pr2, error: pr2Err } = await supabase
    .from('pr2_requests')
    .select('*')
    .eq('pr2_number', pr2Number)
    .single();

  if (pr2Err || !pr2) {
    console.error('Error fetching PR2 or PR2 not found:', pr2Err);
    return;
  }

  const pr1Id = pr2.pr1_id;
  const pr2Id = pr2.id;
  
  if (!pr1Id) {
    console.error('This PR2 is not linked to a PR1, cannot apply the warehouse unwind fix.');
    return;
  }

  console.log(`Unwinding PR2 ${pr2Id} -> PR1 ${pr1Id}`);

  // 1. Delete PR2 items
  console.log('- Deleting PR2 items...');
  await supabase.from('pr2_items').delete().eq('pr2_id', pr2Id);

  // 2. Delete PR2 request
  console.log('- Deleting PR2 record...');
  await supabase.from('pr2_requests').delete().eq('id', pr2Id);

  // 3. Delete Warehouse Validation items
  const { data: wv } = await supabase.from('warehouse_validations').select('id').eq('pr1_id', pr1Id);
  if (wv && wv.length > 0) {
    for (const validation of wv) {
      console.log(`- Deleting warehouse validation items for validation ${validation.id}...`);
      await supabase.from('warehouse_validation_items').delete().eq('validation_id', validation.id);
    }
  }

  // 4. Delete Warehouse Validations
  console.log('- Deleting warehouse validations for PR1...');
  await supabase.from('warehouse_validations').delete().eq('pr1_id', pr1Id);

  // 5. Reset PR1 status to 'approved_for_warehouse'
  console.log('- Resetting PR1 status to approved_for_warehouse...');
  await supabase.from('pr1_requests').update({ status: 'approved_for_warehouse' }).eq('id', pr1Id);

  // 6. Delete Approval Instances for PR2 (optional, but good for cleanup since PR2 is gone)
  console.log('- Cleaning up orphaned approval instances...');
  await supabase.from('approval_instances').delete().eq('document_id', pr2Id);

  console.log('Done! The PR1 is now back in the Warehouse Queue.');
}

heal();
