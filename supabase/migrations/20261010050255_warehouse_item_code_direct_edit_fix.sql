-- Replace the separate override with an atomic edit of the same existing item.
-- Direct-edit release with explicit cancellation of the one reviewed legacy demo override.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- Stop old RPC/header/association writers while checking the reviewed transition.
LOCK TABLE public.pr1_requests, public.warehouse_validations, public.pr1_items,
  public.warehouse_validation_items, public.pr2_requests, public.pr2_items,
  public.rfq_batches, public.warehouse_item_code_corrections,
  public.warehouse_item_code_pr2_context, public.warehouse_item_code_pr2_snapshots
  IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.warehouse_item_code_pr2_context)
    OR EXISTS (SELECT 1 FROM public.warehouse_item_code_pr2_snapshots)
    OR EXISTS (SELECT 1 FROM public.warehouse_validation_items i
      JOIN public.pr1_items p ON p.id=i.pr1_item_id WHERE i.item_code IS DISTINCT FROM p.item_code)
  THEN RAISE EXCEPTION 'Direct-edit transition requires reviewed reconciliation; refusing installation'; END IF;
  -- User explicitly requested reverting/removing Demo Code, NOT the request/item.
  -- Resolve generated IDs through the audited business document and relationships.
  -- Any additional event, changed code, downstream document or lifecycle refuses release.
  IF EXISTS (SELECT 1 FROM public.warehouse_item_code_corrections) THEN
    IF (SELECT count(*) FROM public.warehouse_item_code_corrections)<>1
      OR (SELECT count(*) FROM public.pr1_requests WHERE pr1_number='PR1-2026-0077')<>1
      OR NOT EXISTS (
        SELECT 1 FROM public.warehouse_item_code_corrections c
        JOIN public.pr1_requests r ON r.id=c.pr1_id
        JOIN public.pr1_items p ON p.id=c.pr1_item_id AND p.pr1_id=r.id
        JOIN public.warehouse_validations w ON w.id=c.validation_id AND w.pr1_id=r.id
        JOIN public.warehouse_validation_items i ON i.id=c.validation_item_id
          AND i.validation_id=w.id AND i.pr1_item_id=p.id
        WHERE r.pr1_number='PR1-2026-0077' AND r.status='approved_for_warehouse'
          AND r.request_type='goods' AND w.decision IS NULL
          AND p.description='Demo Item' AND p.item_code='' AND i.item_code=''
          AND c.original_pr1_code='' AND c.previous_code='' AND c.new_code='Demo Code'
          AND c.actor_name_snapshot='Pedro Santos'
          AND c.created_at='2026-10-10 04:47:45.345796+00'::timestamptz
          AND NOT EXISTS(SELECT 1 FROM public.pr2_requests q WHERE q.pr1_id=r.id)
          AND NOT EXISTS(SELECT 1 FROM public.rfq_batches b WHERE b.pr1_id=r.id))
    THEN RAISE EXCEPTION 'Direct-edit transition requires reviewed reconciliation; refusing installation'; END IF;
  END IF;
END $$;

-- Protected audit annotation only. Retain every original event field; do not
-- insert/delete items, replay the override, impersonate its actor or erase history.
ALTER TABLE public.warehouse_item_code_corrections
  ADD COLUMN transition_resolution text,
  ADD COLUMN transition_resolved_at timestamptz,
  ADD CONSTRAINT wic_transition_resolution_check CHECK (
    (transition_resolution IS NULL AND transition_resolved_at IS NULL) OR
    (transition_resolution IS NOT NULL AND transition_resolution='cancelled_override_keep_current'
      AND transition_resolved_at IS NOT NULL));
UPDATE public.warehouse_item_code_corrections
  SET transition_resolution='cancelled_override_keep_current',
      transition_resolved_at=pg_catalog.clock_timestamp();

-- No codes here: a non-client-forgeable, exact-row transaction capability.
CREATE TABLE public.warehouse_item_code_write_permits (
  backend_pid integer NOT NULL, transaction_id xid8 NOT NULL,
  pr1_item_id uuid NOT NULL, validation_item_id uuid NOT NULL,
  PRIMARY KEY(backend_pid,transaction_id,pr1_item_id,validation_item_id)
);
ALTER TABLE public.warehouse_item_code_write_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.warehouse_item_code_write_permits FROM PUBLIC,anon,authenticated;

-- Immutable per-document code values, not new operational items or overrides.
CREATE TABLE public.warehouse_item_code_rfq_history (
  rfq_id uuid NOT NULL, pr1_item_id uuid NOT NULL, item_code text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(rfq_id,pr1_item_id)
);
ALTER TABLE public.warehouse_item_code_rfq_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.warehouse_item_code_rfq_history FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.wic_guard_item_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.item_code IS NOT DISTINCT FROM OLD.item_code THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='pr1_items' THEN
    IF EXISTS (SELECT 1 FROM public.warehouse_item_code_write_permits c
      WHERE c.backend_pid=pg_catalog.pg_backend_pid() AND c.transaction_id=pg_catalog.pg_current_xact_id()
        AND c.pr1_item_id=OLD.id AND NEW.id=OLD.id AND NEW.pr1_id=OLD.pr1_id)
    THEN RETURN NEW; END IF;
    -- Existing requester workflow resets validation before syncing draft/revision items.
    IF EXISTS (SELECT 1 FROM public.pr1_requests p WHERE p.id=OLD.pr1_id
      AND NEW.pr1_id=OLD.pr1_id AND p.requisitioner_id=auth.uid()
      AND p.status IN ('draft','revision_requested'))
      AND NOT EXISTS (SELECT 1 FROM public.warehouse_validations w WHERE w.pr1_id=OLD.pr1_id)
    THEN RETURN NEW; END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.warehouse_item_code_write_permits c
      WHERE c.backend_pid=pg_catalog.pg_backend_pid() AND c.transaction_id=pg_catalog.pg_current_xact_id()
        AND c.validation_item_id=OLD.id AND c.pr1_item_id=OLD.pr1_item_id
        AND NEW.id=OLD.id AND NEW.pr1_item_id=OLD.pr1_item_id AND NEW.validation_id=OLD.validation_id)
    THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Item code changes require the checked warehouse save or editable requester workflow'
    USING ERRCODE='42501';
END $$;
REVOKE ALL ON FUNCTION public.wic_guard_item_code() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wic_pr1_item_code_guard BEFORE UPDATE OF item_code ON public.pr1_items
  FOR EACH ROW EXECUTE FUNCTION public.wic_guard_item_code();
CREATE TRIGGER wic_validation_item_code_guard BEFORE UPDATE OF item_code ON public.warehouse_validation_items
  FOR EACH ROW EXECUTE FUNCTION public.wic_guard_item_code();

-- Caller holds the same PR1 advisory lock. Validate the exact document before capture.
CREATE FUNCTION public.wic_capture_rfq_codes(p_rfq_id uuid,p_pr1_id uuid,p_pr2_id uuid,p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_archive boolean:=false; v_count bigint; v_parent uuid; v_item record; v_code text;
BEGIN
  IF p_pr1_id IS NULL THEN RETURN; END IF;
  IF p_pr2_id IS NOT NULL THEN
    SELECT count(*),min(d.pr1_id::text)::uuid INTO v_count,v_parent FROM (
      SELECT p.pr1_id FROM public.pr2_requests p WHERE p.id=p_pr2_id
      UNION ALL SELECT p.pr1_id FROM public.pr2_requests_archive p WHERE p.id=p_pr2_id
    ) d;
    IF v_count<>1 OR v_parent IS DISTINCT FROM p_pr1_id THEN
      RAISE EXCEPTION 'RFQ linked PR2 is missing or ambiguous or belongs to another PR1' USING ERRCODE='55000';
    END IF;
    v_archive:=EXISTS(SELECT 1 FROM public.pr2_requests_archive p WHERE p.id=p_pr2_id);
  END IF;
  FOR v_item IN SELECT p.id,p.item_code FROM public.pr1_items p
    WHERE p.pr1_id=p_pr1_id AND (p_item_id IS NULL OR p.id=p_item_id)
  LOOP
    -- First capture wins even when the RFQ is later relinked.
    IF EXISTS(SELECT 1 FROM public.warehouse_item_code_rfq_history h
      WHERE h.rfq_id=p_rfq_id AND h.pr1_item_id=v_item.id) THEN CONTINUE; END IF;
    SELECT count(*),min(d.item_code) INTO v_count,v_code FROM (
      SELECT i.item_code FROM public.pr2_items i
        WHERE NOT v_archive AND i.pr2_id=p_pr2_id AND i.pr1_item_id=v_item.id
      UNION ALL SELECT i.item_code FROM public.pr2_items_archive i
        WHERE v_archive AND i.pr2_id=p_pr2_id AND i.pr1_item_id=v_item.id
    ) d;
    IF v_count>1 THEN RAISE EXCEPTION 'RFQ linked item mapping is ambiguous' USING ERRCODE='55000'; END IF;
    -- Missing/unlinked lines freeze the value visible now, never claim reconstructed history.
    IF v_count=0 THEN v_code:=v_item.item_code; END IF;
    INSERT INTO public.warehouse_item_code_rfq_history(rfq_id,pr1_item_id,item_code)
      VALUES(p_rfq_id,v_item.id,v_code) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.wic_capture_rfq_codes(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.wic_serialize_rfq_codes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_key uuid;
BEGIN
  IF TG_OP='UPDATE' THEN
    FOR v_key IN SELECT DISTINCT k FROM pg_catalog.unnest(ARRAY[OLD.pr1_id,NEW.pr1_id]) k
      WHERE k IS NOT NULL ORDER BY k
    LOOP PERFORM public.wic_lock_pr1(v_key); END LOOP;
    PERFORM public.wic_capture_rfq_codes(OLD.id,OLD.pr1_id,OLD.pr2_id,NULL);
  ELSIF NEW.pr1_id IS NOT NULL THEN PERFORM public.wic_lock_pr1(NEW.pr1_id);
  END IF;
  PERFORM public.wic_capture_rfq_codes(NEW.id,NEW.pr1_id,NEW.pr2_id,NULL);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wic_serialize_rfq_codes() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wic_rfq_codes BEFORE INSERT OR UPDATE OF pr1_id,pr2_id ON public.rfq_batches
  FOR EACH ROW EXECUTE FUNCTION public.wic_serialize_rfq_codes();

CREATE OR REPLACE FUNCTION public.update_warehouse_item_code(
  p_validation_item_id uuid,p_expected_code text,p_new_code text
) RETURNS TABLE(validation_id uuid,validation_item_id uuid,pr1_item_id uuid,
  effective_code text,correction_id text,changed_at timestamptz,changed_by_name text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_pr1_id uuid; v_item record; v_actor text; v_new text; v_saved text;
  v_event public.warehouse_item_code_corrections%ROWTYPE; v_rfq record;
BEGIN
  SELECT p.full_name INTO v_actor FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE p.id=auth.uid() AND p.active AND r.name='warehouse';
  IF NOT FOUND THEN RAISE EXCEPTION 'Active warehouse authorization required' USING ERRCODE='42501'; END IF;
  IF p_expected_code IS NULL OR p_new_code IS NULL THEN
    RAISE EXCEPTION 'Expected and new item codes must not be null' USING ERRCODE='22004'; END IF;
  SELECT w.pr1_id INTO v_pr1_id FROM public.warehouse_validation_items i
    JOIN public.warehouse_validations w ON w.id=i.validation_id WHERE i.id=p_validation_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Validation item not found' USING ERRCODE='55000'; END IF;
  PERFORM public.wic_lock_pr1(v_pr1_id);
  SELECT i.id,i.validation_id,i.pr1_item_id,p.item_code,i.item_code AS copy_code,
    w.decision,pr.status,pr.request_type INTO v_item
    FROM public.warehouse_validation_items i
    JOIN public.warehouse_validations w ON w.id=i.validation_id AND w.pr1_id=v_pr1_id
    JOIN public.pr1_items p ON p.id=i.pr1_item_id AND p.pr1_id=w.pr1_id
    JOIN public.pr1_requests pr ON pr.id=w.pr1_id WHERE i.id=p_validation_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Validation item was replaced or removed' USING ERRCODE='55000'; END IF;
  SELECT p.full_name INTO v_actor FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE p.id=auth.uid() AND p.active AND r.name='warehouse';
  IF NOT FOUND THEN RAISE EXCEPTION 'Active warehouse authorization required' USING ERRCODE='42501'; END IF;
  IF v_item.status<>'approved_for_warehouse' OR v_item.request_type NOT IN ('goods','services')
    OR v_item.decision IS NOT NULL OR EXISTS(SELECT 1 FROM public.pr2_requests p WHERE p.pr1_id=v_pr1_id)
  THEN RAISE EXCEPTION 'Item code editing is no longer available' USING ERRCODE='55000'; END IF;
  IF v_item.copy_code IS DISTINCT FROM v_item.item_code THEN
    RAISE EXCEPTION 'PR1 and validation code copies disagree; reload and reconcile' USING ERRCODE='55000'; END IF;
  IF p_expected_code IS DISTINCT FROM v_item.item_code THEN
    RAISE EXCEPTION 'Item code changed; reload before retrying' USING ERRCODE='40001'; END IF;
  v_new:=pg_catalog.btrim(p_new_code,' ');
  SELECT c.* INTO v_event FROM public.warehouse_item_code_corrections c
    WHERE c.pr1_id=v_pr1_id AND c.validation_id=v_item.validation_id
      AND c.validation_item_id=v_item.id AND c.pr1_item_id=v_item.pr1_item_id
      AND c.transition_resolution IS NULL ORDER BY c.id DESC LIMIT 1;
  IF v_new IS DISTINCT FROM v_item.item_code THEN
    FOR v_rfq IN SELECT b.id,b.pr2_id FROM public.rfq_batches b WHERE b.pr1_id=v_pr1_id
    LOOP PERFORM public.wic_capture_rfq_codes(v_rfq.id,v_pr1_id,v_rfq.pr2_id,v_item.pr1_item_id); END LOOP;
    INSERT INTO public.warehouse_item_code_write_permits
      VALUES(pg_catalog.pg_backend_pid(),pg_catalog.pg_current_xact_id(),v_item.pr1_item_id,v_item.id);
    UPDATE public.pr1_items p SET item_code=v_new
      WHERE p.id=v_item.pr1_item_id AND p.pr1_id=v_pr1_id
        AND p.item_code IS NOT DISTINCT FROM p_expected_code RETURNING p.item_code INTO v_saved;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item code changed; reload before retrying' USING ERRCODE='40001'; END IF;
    UPDATE public.warehouse_validation_items i SET item_code=v_saved
      WHERE i.id=v_item.id AND i.validation_id=v_item.validation_id AND i.pr1_item_id=v_item.pr1_item_id
        AND i.item_code IS NOT DISTINCT FROM v_item.item_code;
    IF NOT FOUND THEN RAISE EXCEPTION 'Validation item changed or was removed' USING ERRCODE='55000'; END IF;
    DELETE FROM public.warehouse_item_code_write_permits c WHERE c.backend_pid=pg_catalog.pg_backend_pid()
      AND c.transaction_id=pg_catalog.pg_current_xact_id() AND c.pr1_item_id=v_item.pr1_item_id AND c.validation_item_id=v_item.id;
    INSERT INTO public.warehouse_item_code_corrections AS c(pr1_id,validation_id,validation_item_id,pr1_item_id,
      original_pr1_code,previous_code,new_code,actor_id,actor_name_snapshot)
      VALUES(v_pr1_id,v_item.validation_id,v_item.id,v_item.pr1_item_id,v_item.item_code,
        v_item.item_code,v_saved,auth.uid(),v_actor) RETURNING c.* INTO v_event;
  END IF;
  RETURN QUERY SELECT v_item.validation_id,v_item.id,v_item.pr1_item_id,v_new,
    v_event.id::text,v_event.created_at,v_event.actor_name_snapshot;
END $$;
REVOKE ALL ON FUNCTION public.update_warehouse_item_code(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_warehouse_item_code(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_warehouse_item_codes(p_validation_id uuid)
RETURNS TABLE(validation_id uuid,validation_item_id uuid,pr1_item_id uuid,
  original_pr1_code text,effective_code text,correction_id text,changed_at timestamptz,changed_by_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE p.id=auth.uid() AND p.active AND r.name IN ('warehouse','admin'))
  THEN RAISE EXCEPTION 'Warehouse code read not authorized' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.warehouse_validations w WHERE w.id=p_validation_id)
  THEN RAISE EXCEPTION 'Validation not found'; END IF;
  IF EXISTS(SELECT 1 FROM public.warehouse_validation_items i
    JOIN public.warehouse_validations w ON w.id=i.validation_id
    LEFT JOIN public.pr1_items p ON p.id=i.pr1_item_id AND p.pr1_id=w.pr1_id
    WHERE w.id=p_validation_id AND (p.id IS NULL OR p.item_code IS DISTINCT FROM i.item_code))
  THEN RAISE EXCEPTION 'PR1 and validation code copies disagree' USING ERRCODE='55000'; END IF;
  RETURN QUERY SELECT w.id,i.id,p.id,p.item_code,p.item_code,c.id::text,c.created_at,c.actor_name_snapshot
    FROM public.warehouse_validations w JOIN public.warehouse_validation_items i ON i.validation_id=w.id
    JOIN public.pr1_items p ON p.id=i.pr1_item_id AND p.pr1_id=w.pr1_id
    LEFT JOIN LATERAL(SELECT e.* FROM public.warehouse_item_code_corrections e
      WHERE e.pr1_id=w.pr1_id AND e.validation_id=w.id AND e.validation_item_id=i.id AND e.pr1_item_id=p.id
        AND e.transition_resolution IS NULL
      ORDER BY e.id DESC LIMIT 1) c ON true WHERE w.id=p_validation_id;
END $$;
REVOKE ALL ON FUNCTION public.get_warehouse_item_codes(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_warehouse_item_codes(uuid) TO authenticated;

-- Retain the header trigger's serialization, but stop generating obsolete contexts.
CREATE OR REPLACE FUNCTION public.wic_capture_pr2_context() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.pr1_id IS NOT NULL AND NEW.request_type IN ('goods','services')
    THEN PERFORM public.wic_lock_pr1(NEW.pr1_id); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wic_capture_pr2_context() FROM PUBLIC,anon,authenticated;
DROP TRIGGER wic_pr2_snapshot ON public.pr2_items;
-- Existing BEFORE trigger retains its name; current PR1 is now authoritative.
CREATE OR REPLACE FUNCTION public.wic_snapshot_pr2_code() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_pr1_id uuid; v_code text;
BEGIN
  IF NEW.pr1_item_id IS NULL THEN RETURN NEW; END IF;
  SELECT p.pr1_id INTO v_pr1_id FROM public.pr2_requests p
    JOIN public.pr1_requests r ON r.id=p.pr1_id AND r.request_type IN ('goods','services')
    WHERE p.id=NEW.pr2_id AND p.request_type IN ('goods','services');
  IF v_pr1_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.wic_lock_pr1(v_pr1_id);
  IF NOT EXISTS(SELECT 1 FROM public.warehouse_validations w WHERE w.pr1_id=v_pr1_id)
    THEN RETURN NEW; END IF; -- native/planning/no-validation paths remain untouched
  SELECT p.item_code INTO v_code FROM public.pr1_items p
    JOIN public.warehouse_validations w ON w.pr1_id=p.pr1_id
    JOIN public.warehouse_validation_items i ON i.validation_id=w.id AND i.pr1_item_id=p.id
    WHERE p.id=NEW.pr1_item_id AND p.pr1_id=v_pr1_id AND i.item_code=p.item_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Warehouse PR2 item context is missing or inconsistent' USING ERRCODE='55000'; END IF;
  NEW.item_code:=v_code;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wic_snapshot_pr2_code() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_rfq_warehouse_item_code_snapshots(p_rfq_id uuid)
RETURNS TABLE(pr1_item_id uuid,item_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_role text; v_rfq public.rfq_batches%ROWTYPE;
  v_count bigint; v_parent uuid; v_archive boolean:=false;
BEGIN
  SELECT r.name INTO v_role FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE p.id=v_actor AND p.active IS TRUE;
  IF v_actor IS NULL OR v_role IS NULL THEN RAISE EXCEPTION 'RFQ code access denied' USING ERRCODE='42501'; END IF;
  SELECT b.* INTO v_rfq FROM public.rfq_batches b WHERE b.id=p_rfq_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RFQ code access denied' USING ERRCODE='42501'; END IF;
  IF NOT (
    (v_role='supplier' AND EXISTS(SELECT 1 FROM public.rfq_suppliers s WHERE s.rfq_id=v_rfq.id AND s.supplier_id=v_actor))
    OR (v_role<>'supplier' AND ((v_role IN ('warehouse','procurement','approver') AND
      (v_rfq.pr1_id IS NULL OR public.can_read_pr1(v_rfq.pr1_id)))
      OR EXISTS(SELECT 1 FROM public.pr1_requests p WHERE p.id=v_rfq.pr1_id AND p.requisitioner_id=v_actor)
      OR (v_rfq.pr1_id IS NULL AND EXISTS(SELECT 1 FROM public.pr2_requests p WHERE p.id=v_rfq.pr2_id AND p.requisitioner_id=v_actor))))
  ) THEN RAISE EXCEPTION 'RFQ code access denied' USING ERRCODE='42501'; END IF;
  IF v_rfq.pr1_id IS NULL THEN
    IF EXISTS(SELECT 1 FROM public.warehouse_item_code_rfq_history h WHERE h.rfq_id=v_rfq.id)
    THEN RAISE EXCEPTION 'RFQ historical PR1 association was removed' USING ERRCODE='55000'; END IF;
    RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM public.warehouse_item_code_rfq_history h
    LEFT JOIN public.pr1_items p ON p.id=h.pr1_item_id AND p.pr1_id=v_rfq.pr1_id
    WHERE h.rfq_id=v_rfq.id AND p.id IS NULL)
  THEN RAISE EXCEPTION 'RFQ historical item association changed or is missing' USING ERRCODE='55000'; END IF;
  IF v_rfq.pr2_id IS NOT NULL THEN
    SELECT count(*),min(d.pr1_id::text)::uuid INTO v_count,v_parent FROM (
      SELECT p.pr1_id FROM public.pr2_requests p WHERE p.id=v_rfq.pr2_id
      UNION ALL SELECT p.pr1_id FROM public.pr2_requests_archive p WHERE p.id=v_rfq.pr2_id) d;
    IF v_count<>1 OR v_parent IS DISTINCT FROM v_rfq.pr1_id THEN
      RAISE EXCEPTION 'RFQ linked PR2 is missing or ambiguous or does not match' USING ERRCODE='55000'; END IF;
    v_archive:=EXISTS(SELECT 1 FROM public.pr2_requests_archive p WHERE p.id=v_rfq.pr2_id);
  END IF;
  IF EXISTS(WITH document_items AS (
      SELECT i.pr1_item_id FROM public.pr2_items i WHERE NOT v_archive AND i.pr2_id=v_rfq.pr2_id
      UNION ALL SELECT i.pr1_item_id FROM public.pr2_items_archive i WHERE v_archive AND i.pr2_id=v_rfq.pr2_id)
    SELECT 1 FROM document_items i WHERE i.pr1_item_id IS NOT NULL GROUP BY i.pr1_item_id HAVING count(*)>1)
  THEN RAISE EXCEPTION 'RFQ linked item mapping is ambiguous' USING ERRCODE='55000'; END IF;
  -- After a direct edit, falling back to current PR1 for an uncaptured historical line is unsafe.
  IF EXISTS(SELECT 1 FROM public.pr1_items p WHERE p.pr1_id=v_rfq.pr1_id
    AND EXISTS(SELECT 1 FROM public.warehouse_item_code_corrections c WHERE c.pr1_item_id=p.id)
    AND NOT EXISTS(SELECT 1 FROM public.warehouse_item_code_rfq_history h WHERE h.rfq_id=v_rfq.id AND h.pr1_item_id=p.id)
    AND NOT EXISTS(SELECT 1 FROM public.pr2_items i WHERE NOT v_archive AND i.pr2_id=v_rfq.pr2_id AND i.pr1_item_id=p.id)
    AND NOT EXISTS(SELECT 1 FROM public.pr2_items_archive i WHERE v_archive AND i.pr2_id=v_rfq.pr2_id AND i.pr1_item_id=p.id))
  THEN RAISE EXCEPTION 'RFQ historical code snapshot is missing' USING ERRCODE='55000'; END IF;
  RETURN QUERY WITH document_items AS (
    SELECT i.pr1_item_id,i.item_code FROM public.pr2_items i WHERE NOT v_archive AND i.pr2_id=v_rfq.pr2_id
    UNION ALL SELECT i.pr1_item_id,i.item_code FROM public.pr2_items_archive i WHERE v_archive AND i.pr2_id=v_rfq.pr2_id)
    SELECT h.pr1_item_id,h.item_code FROM public.warehouse_item_code_rfq_history h WHERE h.rfq_id=v_rfq.id
    UNION ALL SELECT d.pr1_item_id,d.item_code FROM document_items d
      JOIN public.pr1_items p ON p.id=d.pr1_item_id AND p.pr1_id=v_rfq.pr1_id
      WHERE NOT EXISTS(SELECT 1 FROM public.warehouse_item_code_rfq_history h WHERE h.rfq_id=v_rfq.id AND h.pr1_item_id=d.pr1_item_id);
END $$;
REVOKE ALL ON FUNCTION public.get_rfq_warehouse_item_code_snapshots(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_rfq_warehouse_item_code_snapshots(uuid) TO authenticated;

-- Preserve freshly installed live business statements verbatim; prepend only the lock.
-- Refuse unexpected bodies instead of silently reconstructing reset/unwind behavior.
DO $$ DECLARE v_signature text; v_definition text; v_hash text; v_expected text; BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.reset_warehouse_validation_on_pr1_resubmit(uuid)',
    'public.unwind_pr2_to_warehouse(uuid,boolean)']
  LOOP
    v_definition:=pg_catalog.pg_get_functiondef(v_signature::regprocedure);
    SELECT pg_catalog.md5(pg_catalog.btrim(pg_catalog.replace(p.prosrc,E'\r',''),E'\n '))
      INTO v_hash FROM pg_catalog.pg_proc p WHERE p.oid=v_signature::regprocedure;
    v_expected:=CASE WHEN v_signature='public.reset_warehouse_validation_on_pr1_resubmit(uuid)'
      THEN 'cc84b293d02a3763e0be4ce6001de4f0' ELSE 'd0bc08cd589a9255c84c50987306d809' END;
    IF v_definition NOT LIKE '%p_pr1_id uuid%' OR v_definition !~ E'BEGIN\r?\n'
      OR v_definition LIKE '%PERFORM public.wic_lock_pr1(p_pr1_id)%'
      OR v_hash IS DISTINCT FROM v_expected
    THEN RAISE EXCEPTION 'Unexpected reset/unwind definition; review live body before installation'; END IF;
    v_definition:=pg_catalog.regexp_replace(v_definition,E'BEGIN\r?\n',
      E'BEGIN\n  PERFORM public.wic_lock_pr1(p_pr1_id);\n');
    EXECUTE v_definition;
  END LOOP;
END $$;
COMMIT;
