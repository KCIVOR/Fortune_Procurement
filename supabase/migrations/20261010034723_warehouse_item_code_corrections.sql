-- Verified in isolated PostgreSQL/JWT tests; deployed via MCP on 2026-10-10.
-- Release only with compatible downstream readers; see Phase 1 verification report.
-- Original PR1 and validation codes are deliberately never updated here.
CREATE TABLE public.warehouse_item_code_corrections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pr1_id uuid NOT NULL,
  validation_id uuid NOT NULL,
  validation_item_id uuid NOT NULL,
  pr1_item_id uuid NOT NULL,
  original_pr1_code text NOT NULL,
  previous_code text NOT NULL,
  new_code text NOT NULL,
  actor_id uuid NOT NULL,
  actor_name_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warehouse_item_code_latest_idx ON public.warehouse_item_code_corrections
  (validation_id, pr1_item_id, id DESC);
CREATE INDEX warehouse_item_code_history_idx ON public.warehouse_item_code_corrections
  (pr1_id, id DESC);

-- Historical workflow IDs intentionally have no ephemeral-row foreign keys.
CREATE TABLE public.warehouse_item_code_pr2_context (
  pr2_id uuid PRIMARY KEY,
  pr1_id uuid NOT NULL,
  validation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.warehouse_item_code_pr2_snapshots (
  pr2_item_id uuid PRIMARY KEY,
  pr2_id uuid NOT NULL,
  pr1_item_id uuid NOT NULL,
  validation_id uuid NOT NULL,
  correction_id bigint NOT NULL REFERENCES public.warehouse_item_code_corrections(id),
  item_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warehouse_item_code_pr2_snapshot_idx
  ON public.warehouse_item_code_pr2_snapshots(pr2_id, pr1_item_id);

ALTER TABLE public.warehouse_item_code_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_item_code_pr2_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_item_code_pr2_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.warehouse_item_code_corrections,
  public.warehouse_item_code_pr2_context, public.warehouse_item_code_pr2_snapshots
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.warehouse_item_code_corrections_id_seq
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.warehouse_item_code_corrections,
  public.warehouse_item_code_pr2_context, public.warehouse_item_code_pr2_snapshots TO authenticated;
CREATE POLICY warehouse_item_code_admin_history ON public.warehouse_item_code_corrections
  FOR SELECT TO authenticated USING (public.is_role('admin'));
CREATE POLICY warehouse_item_code_admin_context ON public.warehouse_item_code_pr2_context
  FOR SELECT TO authenticated USING (public.is_role('admin'));
CREATE POLICY warehouse_item_code_admin_snapshots ON public.warehouse_item_code_pr2_snapshots
  FOR SELECT TO authenticated USING (public.is_role('admin'));

-- Internal only: every participating writer uses the identical transaction key.
CREATE FUNCTION public.wic_lock_pr1(p_pr1_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Warehouse code enforcement requires READ COMMITTED';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('warehouse-item-code-v1:' || p_pr1_id::text, 0));
END;
$$;
REVOKE ALL ON FUNCTION public.wic_lock_pr1(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.update_warehouse_item_code(
  p_validation_item_id uuid, p_expected_code text, p_new_code text
) RETURNS TABLE (
  validation_id uuid, validation_item_id uuid, pr1_item_id uuid,
  effective_code text, correction_id text, changed_at timestamptz, changed_by_name text
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_pr1_id uuid;
  v_item record;
  v_event public.warehouse_item_code_corrections%ROWTYPE;
  v_actor_name text;
  v_effective text;
  v_new text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND p.active AND r.name = 'warehouse'
  ) THEN RAISE EXCEPTION 'Active warehouse authorization required' USING ERRCODE = '42501'; END IF;
  IF p_expected_code IS NULL OR p_new_code IS NULL THEN
    RAISE EXCEPTION 'Expected and new item codes must not be null' USING ERRCODE = '22004';
  END IF;
  SELECT w.pr1_id INTO v_pr1_id
  FROM public.warehouse_validation_items i
  JOIN public.warehouse_validations w ON w.id = i.validation_id
  WHERE i.id = p_validation_item_id;
  IF v_pr1_id IS NULL THEN RAISE EXCEPTION 'Validation item not found'; END IF;
  PERFORM public.wic_lock_pr1(v_pr1_id);
  -- Fresh post-lock statement; no workflow UPDATE or row lock is acquired.
  SELECT i.id, i.validation_id, i.pr1_item_id, p.item_code, w.decision,
    pr.status, pr.request_type INTO v_item
  FROM public.warehouse_validation_items i
  JOIN public.warehouse_validations w ON w.id = i.validation_id AND w.pr1_id = v_pr1_id
  JOIN public.pr1_items p ON p.id = i.pr1_item_id AND p.pr1_id = w.pr1_id
  JOIN public.pr1_requests pr ON pr.id = w.pr1_id
  WHERE i.id = p_validation_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Validation item was replaced or removed'; END IF;
  SELECT p.full_name INTO v_actor_name FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid() AND p.active AND r.name = 'warehouse';
  IF NOT FOUND THEN RAISE EXCEPTION 'Active warehouse authorization required' USING ERRCODE = '42501'; END IF;
  IF v_item.status <> 'approved_for_warehouse'
    OR v_item.request_type NOT IN ('goods', 'services') OR v_item.decision IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.pr2_requests pr WHERE pr.pr1_id = v_pr1_id)
  THEN RAISE EXCEPTION 'Item code editing is no longer available' USING ERRCODE = '55000'; END IF;
  SELECT c.* INTO v_event FROM public.warehouse_item_code_corrections c
  WHERE c.validation_id = v_item.validation_id AND c.validation_item_id = v_item.id
    AND c.pr1_item_id = v_item.pr1_item_id AND c.pr1_id = v_pr1_id
  ORDER BY c.id DESC LIMIT 1;
  v_effective := CASE WHEN v_event.id IS NULL THEN v_item.item_code ELSE v_event.new_code END;
  IF p_expected_code IS DISTINCT FROM v_effective THEN
    RAISE EXCEPTION 'Item code changed; reload before retrying' USING ERRCODE = '40001';
  END IF;
  v_new := pg_catalog.btrim(p_new_code, ' ');
  IF v_new IS DISTINCT FROM v_effective THEN
    INSERT INTO public.warehouse_item_code_corrections AS c (
      pr1_id, validation_id, validation_item_id, pr1_item_id, original_pr1_code,
      previous_code, new_code, actor_id, actor_name_snapshot
    ) VALUES (v_pr1_id, v_item.validation_id, v_item.id, v_item.pr1_item_id,
      v_item.item_code, v_effective, v_new, auth.uid(), v_actor_name)
    RETURNING c.* INTO v_event;
  END IF;
  RETURN QUERY SELECT v_item.validation_id, v_item.id, v_item.pr1_item_id,
    v_new, v_event.id::text, v_event.created_at, v_event.actor_name_snapshot;
END;
$$;
REVOKE ALL ON FUNCTION public.update_warehouse_item_code(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_warehouse_item_code(uuid,text,text) TO authenticated;

CREATE FUNCTION public.get_warehouse_item_codes(p_validation_id uuid)
RETURNS TABLE (
  validation_id uuid, validation_item_id uuid, pr1_item_id uuid,
  original_pr1_code text, effective_code text, correction_id text,
  changed_at timestamptz, changed_by_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND p.active AND r.name IN ('warehouse','admin')
  ) THEN RAISE EXCEPTION 'Warehouse code read not authorized' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_validations w WHERE w.id = p_validation_id) THEN
    RAISE EXCEPTION 'Validation not found';
  END IF;
  RETURN QUERY
  SELECT w.id, i.id, i.pr1_item_id, p.item_code,
    CASE WHEN c.id IS NULL THEN p.item_code ELSE c.new_code END,
    c.id::text, c.created_at, c.actor_name_snapshot
  FROM public.warehouse_validations w
  JOIN public.warehouse_validation_items i ON i.validation_id = w.id
  JOIN public.pr1_items p ON p.id = i.pr1_item_id AND p.pr1_id = w.pr1_id
  LEFT JOIN LATERAL (
    SELECT e.* FROM public.warehouse_item_code_corrections e
    WHERE e.validation_id = w.id AND e.validation_item_id = i.id
      AND e.pr1_item_id = p.id AND e.pr1_id = w.pr1_id
    ORDER BY e.id DESC LIMIT 1
  ) c ON true
  WHERE w.id = p_validation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_warehouse_item_codes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_warehouse_item_codes(uuid) TO authenticated;

CREATE FUNCTION public.wic_serialize_pr1_status() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN PERFORM public.wic_lock_pr1(OLD.id); END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.wic_serialize_validation() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.wic_lock_pr1(OLD.pr1_id);
    RETURN OLD;
  END IF;
  IF NEW.decision IS DISTINCT FROM OLD.decision THEN PERFORM public.wic_lock_pr1(OLD.pr1_id); END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.wic_serialize_pr1_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wic_serialize_validation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wic_pr1_status BEFORE UPDATE OF status ON public.pr1_requests
  FOR EACH ROW EXECUTE FUNCTION public.wic_serialize_pr1_status();
CREATE TRIGGER wic_validation_decision BEFORE UPDATE OF decision ON public.warehouse_validations
  FOR EACH ROW EXECUTE FUNCTION public.wic_serialize_validation();
CREATE TRIGGER wic_validation_delete BEFORE DELETE ON public.warehouse_validations
  FOR EACH ROW EXECUTE FUNCTION public.wic_serialize_validation();

CREATE FUNCTION public.wic_capture_pr2_context() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_validation_id uuid;
BEGIN
  IF NEW.pr1_id IS NULL OR NEW.request_type NOT IN ('goods','services') THEN RETURN NEW; END IF;
  PERFORM public.wic_lock_pr1(NEW.pr1_id);
  SELECT w.id INTO v_validation_id FROM public.warehouse_validations w
  WHERE w.pr1_id = NEW.pr1_id;
  IF v_validation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.warehouse_item_code_corrections c
    WHERE c.pr1_id = NEW.pr1_id AND c.validation_id = v_validation_id
  ) THEN
    INSERT INTO public.warehouse_item_code_pr2_context(pr2_id,pr1_id,validation_id)
    VALUES (NEW.id,NEW.pr1_id,v_validation_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.wic_capture_pr2_context() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wic_pr2_context BEFORE INSERT ON public.pr2_requests
  FOR EACH ROW EXECUTE FUNCTION public.wic_capture_pr2_context();

-- Both item triggers resolve the same immutable event under the transaction lock.
CREATE FUNCTION public.wic_snapshot_pr2_code() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_context public.warehouse_item_code_pr2_context%ROWTYPE;
  v_event public.warehouse_item_code_corrections%ROWTYPE;
BEGIN
  IF NEW.pr1_item_id IS NULL THEN RETURN NEW; END IF;
  SELECT x.* INTO v_context FROM public.warehouse_item_code_pr2_context x
    WHERE x.pr2_id = NEW.pr2_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  PERFORM public.wic_lock_pr1(v_context.pr1_id);
  SELECT c.* INTO v_event FROM public.warehouse_item_code_corrections c
  WHERE c.pr1_id = v_context.pr1_id AND c.validation_id = v_context.validation_id
    AND c.pr1_item_id = NEW.pr1_item_id
  ORDER BY c.id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pr2_requests pr
    JOIN public.warehouse_validations w ON w.pr1_id = pr.pr1_id
    JOIN public.warehouse_validation_items i ON i.validation_id = w.id
    JOIN public.pr1_items p ON p.id = i.pr1_item_id AND p.pr1_id = pr.pr1_id
    WHERE pr.id = NEW.pr2_id AND pr.pr1_id = v_context.pr1_id
      AND pr.request_type IN ('goods','services') AND w.id = v_context.validation_id
      AND i.id = v_event.validation_item_id AND p.id = NEW.pr1_item_id
  ) THEN RAISE EXCEPTION 'Corrected PR2 validation context is stale'; END IF;
  IF TG_WHEN = 'BEFORE' THEN
    NEW.item_code := v_event.new_code;
  ELSE
    IF NEW.item_code IS DISTINCT FROM v_event.new_code THEN
      RAISE EXCEPTION 'Corrected PR2 snapshot mismatch';
    END IF;
    INSERT INTO public.warehouse_item_code_pr2_snapshots
      (pr2_item_id,pr2_id,pr1_item_id,validation_id,correction_id,item_code)
    VALUES (NEW.id,NEW.pr2_id,NEW.pr1_item_id,v_context.validation_id,v_event.id,NEW.item_code);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.wic_snapshot_pr2_code() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wic_pr2_code BEFORE INSERT ON public.pr2_items
  FOR EACH ROW EXECUTE FUNCTION public.wic_snapshot_pr2_code();
CREATE TRIGGER wic_pr2_snapshot AFTER INSERT ON public.pr2_items
  FOR EACH ROW EXECUTE FUNCTION public.wic_snapshot_pr2_code();

-- Narrow checked reader for PR1-linked RFQ consumers. This is not a history API.
-- Definer privileges are needed only to inspect the client-inaccessible provenance store
-- and an explicitly linked archive. Authorization mirrors audited RFQ access and narrows
-- staff to existing PR1 document access. No new table grants or policy changes.
CREATE FUNCTION public.get_rfq_warehouse_item_code_snapshots(p_rfq_id uuid)
RETURNS TABLE(pr1_item_id uuid, item_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_rfq public.rfq_batches%ROWTYPE;
  v_pr1_id uuid;
  v_archived boolean := false;
  v_context public.warehouse_item_code_pr2_context%ROWTYPE;
BEGIN
  SELECT r.name INTO v_role FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
    WHERE p.id=v_actor AND p.active IS TRUE;
  IF v_actor IS NULL OR v_role IS NULL THEN RAISE EXCEPTION 'RFQ code access denied' USING ERRCODE='42501'; END IF;
  SELECT rb.* INTO v_rfq FROM public.rfq_batches rb WHERE rb.id=p_rfq_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RFQ code access denied' USING ERRCODE='42501'; END IF;
  IF NOT (
    (v_role='supplier' AND EXISTS (SELECT 1 FROM public.rfq_suppliers rs WHERE rs.rfq_id=v_rfq.id AND rs.supplier_id=v_actor))
    OR (v_role <> 'supplier' AND ((v_role IN ('warehouse','procurement','approver') AND
      (v_rfq.pr1_id IS NULL OR public.can_read_pr1(v_rfq.pr1_id)))
    OR EXISTS (SELECT 1 FROM public.pr1_requests p WHERE p.id=v_rfq.pr1_id AND p.requisitioner_id=v_actor)
    OR (v_rfq.pr1_id IS NULL AND EXISTS (SELECT 1 FROM public.pr2_requests p WHERE p.id=v_rfq.pr2_id AND p.requisitioner_id=v_actor))))
  ) THEN RAISE EXCEPTION 'RFQ code access denied' USING ERRCODE='42501'; END IF;

  -- Native and old unlinked RFQs never inherit any current warehouse correction.
  IF v_rfq.pr1_id IS NULL OR v_rfq.pr2_id IS NULL THEN RETURN; END IF;
  SELECT p.pr1_id INTO v_pr1_id FROM public.pr2_requests p WHERE p.id=v_rfq.pr2_id;
  IF NOT FOUND THEN
    v_archived := true;
    SELECT p.pr1_id INTO v_pr1_id FROM public.pr2_requests_archive p WHERE p.id=v_rfq.pr2_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linked PR2 is missing' USING ERRCODE='55000'; END IF;
  END IF;
  IF v_pr1_id IS DISTINCT FROM v_rfq.pr1_id THEN
    RAISE EXCEPTION 'RFQ and linked PR2 do not match' USING ERRCODE='55000';
  END IF;
  SELECT x.* INTO v_context FROM public.warehouse_item_code_pr2_context x WHERE x.pr2_id=v_rfq.pr2_id;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.warehouse_item_code_pr2_snapshots s WHERE s.pr2_id=v_rfq.pr2_id) THEN
      RAISE EXCEPTION 'RFQ snapshot context is missing' USING ERRCODE='55000';
    END IF;
    RETURN; -- Uncorrected history stays unchanged.
  END IF;
  IF v_context.pr1_id IS DISTINCT FROM v_rfq.pr1_id THEN
    RAISE EXCEPTION 'RFQ snapshot context does not match' USING ERRCODE='55000';
  END IF;

  IF EXISTS (
    WITH document_items AS (
      SELECT i.id,i.pr1_item_id,i.item_code FROM public.pr2_items i WHERE NOT v_archived AND i.pr2_id=v_rfq.pr2_id
      UNION ALL
      SELECT i.id,i.pr1_item_id,i.item_code FROM public.pr2_items_archive i WHERE v_archived AND i.pr2_id=v_rfq.pr2_id
    )
    SELECT 1 FROM public.warehouse_item_code_pr2_snapshots s
    LEFT JOIN public.warehouse_item_code_corrections c ON c.id=s.correction_id
    LEFT JOIN document_items i ON i.id=s.pr2_item_id
    WHERE s.pr2_id=v_rfq.pr2_id AND (
      c.id IS NULL OR i.id IS NULL OR c.pr1_id IS DISTINCT FROM v_rfq.pr1_id
      OR c.validation_id IS DISTINCT FROM v_context.validation_id OR s.validation_id IS DISTINCT FROM v_context.validation_id
      OR c.pr1_item_id IS DISTINCT FROM s.pr1_item_id OR i.pr1_item_id IS DISTINCT FROM s.pr1_item_id
      OR c.new_code IS DISTINCT FROM s.item_code OR i.item_code IS DISTINCT FROM s.item_code)
  ) THEN RAISE EXCEPTION 'RFQ snapshot provenance is inconsistent' USING ERRCODE='55000'; END IF;

  IF EXISTS (
    WITH document_items AS (
      SELECT i.id,i.pr1_item_id FROM public.pr2_items i WHERE NOT v_archived AND i.pr2_id=v_rfq.pr2_id
      UNION ALL
      SELECT i.id,i.pr1_item_id FROM public.pr2_items_archive i WHERE v_archived AND i.pr2_id=v_rfq.pr2_id
    )
    SELECT 1 FROM document_items i WHERE EXISTS (
      SELECT 1 FROM public.warehouse_item_code_corrections c WHERE c.pr1_id=v_rfq.pr1_id
        AND c.validation_id=v_context.validation_id AND c.pr1_item_id=i.pr1_item_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.warehouse_item_code_pr2_snapshots s WHERE s.pr2_id=v_rfq.pr2_id AND s.pr2_item_id=i.id
    )
  ) THEN RAISE EXCEPTION 'RFQ corrected line snapshot is missing' USING ERRCODE='55000'; END IF;

  RETURN QUERY SELECT DISTINCT s.pr1_item_id,s.item_code
    FROM public.warehouse_item_code_pr2_snapshots s WHERE s.pr2_id=v_rfq.pr2_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_rfq_warehouse_item_code_snapshots(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_rfq_warehouse_item_code_snapshots(uuid) TO authenticated;
