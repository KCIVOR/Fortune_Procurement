import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const raw = fs.readFileSync('.env.local', 'utf8');
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
}

async function deleteAll(admin, table, label) {
  const { error, count } = await admin.from(table).delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`${label} (${table}): ${error.message}`);
  console.log(`  ${label}: ${count ?? 0} rows`);
  return count ?? 0;
}

async function deletePipelineNotifications(admin) {
  const types = ['pr1', 'pr2', 'po', 'rfq', 'delivery', 'grn', 'PR1', 'PR2', 'PO', 'RFQ', 'DELIVERY', 'GRN'];
  let total = 0;
  for (const t of types) {
    const { error, count } = await admin
      .from('notifications')
      .delete({ count: 'exact' })
      .eq('document_type', t);
    if (error) throw new Error(`notifications (${t}): ${error.message}`);
    total += count ?? 0;
  }
  console.log(`  pipeline notifications: ${total} rows`);
  return total;
}

async function deletePipelineAuditLogs(admin) {
  const types = ['PR1', 'PR2', 'PO', 'RFQ', 'RFQ_QUOTE', 'DELIVERY', 'GRN'];
  let total = 0;
  for (const t of types) {
    const { error, count } = await admin.from('audit_logs').delete({ count: 'exact' }).eq('document_type', t);
    if (error) throw new Error(`audit_logs (${t}): ${error.message}`);
    total += count ?? 0;
  }
  console.log(`  pipeline audit_logs: ${total} rows`);
  return total;
}

async function deleteApprovalRuntime(admin) {
  const { data: instances, error: instErr } = await admin
    .from('approval_instances')
    .select('id')
    .in('document_type', ['PR1', 'PR2', 'PO']);
  if (instErr) throw new Error(`approval_instances select: ${instErr.message}`);

  const ids = (instances ?? []).map((r) => r.id);
  if (ids.length === 0) {
    console.log('  approval runtime: 0 instances');
    return 0;
  }

  const { error: poErr } = await admin
    .from('po_requests')
    .update({ approval_instance_id: null })
    .in('approval_instance_id', ids);
  if (poErr) throw new Error(`po_requests clear approval_instance_id: ${poErr.message}`);

  const { error: actErr, count: actCount } = await admin
    .from('approval_actions')
    .delete({ count: 'exact' })
    .in('instance_id', ids);
  if (actErr) throw new Error(`approval_actions: ${actErr.message}`);

  const { error: delInstErr, count: instCount } = await admin
    .from('approval_instances')
    .delete({ count: 'exact' })
    .in('id', ids);
  if (delInstErr) throw new Error(`approval_instances delete: ${delInstErr.message}`);

  console.log(`  approval_actions: ${actCount ?? 0} rows`);
  console.log(`  approval_instances: ${instCount ?? 0} rows`);
  return (actCount ?? 0) + (instCount ?? 0);
}

async function main() {
  const env = loadEnvLocal();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Starting PR1→GRN pipeline cleanup...\n');

  console.log('Messages');
  await deleteAll(admin, 'messages', 'messages');
  await deleteAll(admin, 'conversations', 'conversations');

  console.log('\nNotifications & audit');
  await deletePipelineNotifications(admin);
  await deletePipelineAuditLogs(admin);

  console.log('\nApproval runtime');
  await deleteApprovalRuntime(admin);

  console.log('\nGRN & delivery');
  await deleteAll(admin, 'grn_items', 'grn_items');
  await deleteAll(admin, 'grn_receipts', 'grn_receipts');
  await deleteAll(admin, 'delivery_status_history', 'delivery_status_history');
  await deleteAll(admin, 'deliveries', 'deliveries');

  console.log('\nPO');
  await deleteAll(admin, 'po_receipts', 'po_receipts');
  await deleteAll(admin, 'po_items', 'po_items');
  await deleteAll(admin, 'po_requests', 'po_requests');

  console.log('\nPR2');
  await deleteAll(admin, 'pr2_items', 'pr2_items');
  await deleteAll(admin, 'pr2_requests', 'pr2_requests');

  console.log('\nRFQ / canvassing');
  await deleteAll(admin, 'substitute_decisions', 'substitute_decisions');
  await deleteAll(admin, 'supplier_item_selections', 'supplier_item_selections');
  await deleteAll(admin, 'rfq_item_quotes', 'rfq_item_quotes');
  await deleteAll(admin, 'rfq_suppliers', 'rfq_suppliers');
  await deleteAll(admin, 'rfq_batches', 'rfq_batches');

  console.log('\nWarehouse & PR1');
  await deleteAll(admin, 'warehouse_validation_items', 'warehouse_validation_items');
  await deleteAll(admin, 'warehouse_validations', 'warehouse_validations');
  await deleteAll(admin, 'pr1_items', 'pr1_items');
  await deleteAll(admin, 'pr1_requests', 'pr1_requests');

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
