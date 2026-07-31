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
console.log('URL:', env['NEXT_PUBLIC_SUPABASE_URL']);

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
);

async function check() {
  console.log('Fetching PR2-2026-0004...');
  const { data: pr2, error: pr2Err } = await supabase
    .from('pr2_requests')
    .select('*')
    .eq('pr2_number', 'PR2-2026-0004')
    .single();
    
  if (pr2Err) {
    console.error('Error fetching PR2:', pr2Err);
    return;
  }
  console.log('\n--- PR2 ---');
  console.log(pr2);
  
  if (pr2) {
    const { data: pr1 } = await supabase.from('pr1_requests').select('id, pr1_number, status').eq('id', pr2.pr1_id).single();
    console.log('\n--- Linked PR1 ---');
    console.log(pr1);
    
    const { data: wv } = await supabase.from('warehouse_validations').select('id, decision').eq('pr1_id', pr2.pr1_id);
    console.log('\n--- Warehouse Validations ---');
    console.log(wv);
    
    const { data: ai } = await supabase.from('approval_instances').select('id, status, current_step').eq('document_id', pr2.id);
    console.log('\n--- Approval Instances (PR2) ---');
    console.log(ai);
  }
}

check();
