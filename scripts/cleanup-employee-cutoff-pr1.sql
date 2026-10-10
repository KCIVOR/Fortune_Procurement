-- Guarded PR1 cleanup runner template.
-- This file is intentionally fail-closed: an orchestrator must insert the
-- fresh, reviewed UUID/hash manifest into pg_temp.cleanup_scope before the
-- transaction reaches any DELETE. No broad selector is used here.
--
-- Required manifest columns:
--   batch text, root_id uuid, table_name text, id uuid, expected_hash text
--
-- The caller must run one batch per MCP execute_sql call and replace
-- EXPECTED_ROOT_ID, EXPECTED_ROOT_NUMBER, EXPECTED_SCOPE_COUNT,
-- EXPECTED_ROOT_COUNT, EXPECTED_MANIFEST_COUNT, and sequence baselines from
-- the fresh locked audit. The placeholder guard below raises before mutation
-- if these values are not supplied.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE cleanup_scope (
  batch text NOT NULL,
  root_id uuid NOT NULL,
  table_name text NOT NULL,
  id uuid NOT NULL,
  expected_hash text NOT NULL,
  PRIMARY KEY (table_name, id)
);

-- The orchestrator inserts exact audited rows here. Never populate this table
-- from a date, email, status, request-number prefix, or wildcard.
DO $scope_guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.cleanup_scope) THEN
    RAISE EXCEPTION 'REFUSE: frozen cleanup_scope manifest was not supplied';
  END IF;
END
$scope_guard$;

CREATE TEMP TABLE cleanup_operations (
  seq integer NOT NULL,
  operation text NOT NULL,
  expected bigint NOT NULL,
  actual bigint NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.assert_cleanup(ok boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(ok, false) THEN
    RAISE EXCEPTION '%', message;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.delete_scoped(target_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE expected_count bigint; actual_count bigint;
BEGIN
  PERFORM pg_temp.assert_cleanup(
    target_table = ANY (ARRAY[
      'notifications','audit_logs','approval_actions','approval_instances',
      'grn_items','grn_receipts','delivery_status_history','deliveries',
      'compliance_documents','po_receipts','po_items','po_requests',
      'supplier_item_selections','substitute_decisions','rfq_quote_attachments',
      'pr2_items_archive','pr2_requests_archive','rfq_item_quotes',
      'rfq_suppliers','rfq_batches','pr2_item_attachments','pr2_items',
      'pr2_requests','warehouse_validation_items','warehouse_validations',
      'pr1_attachments','pr1_items','pr1_requests'
    ]), 'unexpected delete target: ' || target_table);

  SELECT count(*) INTO expected_count
  FROM pg_temp.cleanup_scope WHERE table_name = target_table;

  EXECUTE format(
    'DELETE FROM public.%I row USING pg_temp.cleanup_scope scope
     WHERE scope.table_name = $1 AND row.id = scope.id',
    target_table
  ) USING target_table;
  GET DIAGNOSTICS actual_count = ROW_COUNT;

  PERFORM pg_temp.assert_cleanup(
    actual_count = expected_count,
    format('%s expected %s rows, deleted %s',
      target_table, expected_count, actual_count));

  INSERT INTO pg_temp.cleanup_operations
  VALUES (
    (SELECT coalesce(max(seq), 0) + 1 FROM pg_temp.cleanup_operations),
    'DELETE ' || target_table, expected_count, actual_count
  );
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.clear_pr2_item_pointers()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE expected_count bigint; actual_count bigint;
BEGIN
  SELECT count(*) INTO expected_count
  FROM pg_temp.cleanup_scope WHERE table_name = 'pr2_items';
  UPDATE public.pr2_items row
  SET rfq_item_quote_id = NULL, selected_rfq_supplier_id = NULL
  FROM pg_temp.cleanup_scope scope
  WHERE scope.table_name = 'pr2_items' AND row.id = scope.id;
  GET DIAGNOSTICS actual_count = ROW_COUNT;
  PERFORM pg_temp.assert_cleanup(actual_count = expected_count,
    'pr2_items pointer-clear count mismatch');
  INSERT INTO pg_temp.cleanup_operations
  VALUES ((SELECT coalesce(max(seq),0)+1 FROM pg_temp.cleanup_operations),
    'CLEAR pr2_items pointers', expected_count, actual_count);
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.clear_pr2_request_pointers()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE expected_count bigint; actual_count bigint;
BEGIN
  SELECT count(*) INTO expected_count
  FROM pg_temp.cleanup_scope WHERE table_name = 'pr2_requests';
  UPDATE public.pr2_requests row
  SET rfq_id = NULL
  FROM pg_temp.cleanup_scope scope
  WHERE scope.table_name = 'pr2_requests' AND row.id = scope.id;
  GET DIAGNOSTICS actual_count = ROW_COUNT;
  PERFORM pg_temp.assert_cleanup(actual_count = expected_count,
    'pr2_requests pointer-clear count mismatch');
  INSERT INTO pg_temp.cleanup_operations
  VALUES ((SELECT coalesce(max(seq),0)+1 FROM pg_temp.cleanup_operations),
    'CLEAR pr2_requests RFQ pointer', expected_count, actual_count);
END
$$;

-- The orchestrator must acquire SHARE ROW EXCLUSIVE locks on all 51 public
-- base tables and rerun the audit before invoking this ordered schedule:
-- notifications, audit_logs, approval_actions, approval_instances,
-- grn_items, grn_receipts, delivery_status_history, deliveries,
-- compliance_documents, po_receipts, po_items, po_requests,
-- supplier_item_selections, substitute_decisions, rfq_quote_attachments,
-- pr2_items_archive, pr2_requests_archive,
-- clear_pr2_item_pointers, rfq_item_quotes, rfq_suppliers,
-- clear_pr2_request_pointers, rfq_batches, pr2_item_attachments,
-- pr2_items, pr2_requests, warehouse_validation_items,
-- warehouse_validations, pr1_attachments, pr1_items, pr1_requests.
--
-- A separate generated invocation performs the schedule twice in one outer
-- transaction: first inside a nested block with a private sentinel exception
-- so the rehearsal rolls back, then again for the real commit. Before COMMIT
-- it requires zero frozen IDs, exact affected counts, unchanged protected
-- fingerprints in both directions, unchanged sequences, and no Storage call.
--
-- This template contains no DELETE invocation by itself.
ROLLBACK;
