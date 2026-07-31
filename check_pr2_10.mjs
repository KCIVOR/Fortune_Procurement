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

async function check() {
  console.log('Fetching PR2-2026-0010...');
  const { data: pr2, error: pr2Err } = await supabase
    .from('pr2_requests')
    .select('*')
    .eq('pr2_number', 'PR2-2026-0010')
    .single();
    
  if (pr2Err) {
    console.error('Error fetching PR2:', pr2Err);
    return;
  }
  
  if (pr2) {
    console.log('PR1 ID linked:', pr2.pr1_id);
    console.log('PR2 request_type:', pr2.request_type);
  }
}

check();
