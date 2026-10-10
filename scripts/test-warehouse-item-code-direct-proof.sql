-- Phase 1 design experiment ONLY, not a production migration or public API.
-- Requires the deployed baseline in a disposable wic_test_* local database.
CREATE TABLE wic_test.rfq_history(rfq_id uuid,pr1_item_id uuid,item_code text NOT NULL,
  PRIMARY KEY(rfq_id,pr1_item_id));
ALTER TABLE wic_test.rfq_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wic_test.rfq_history FROM PUBLIC,anon,authenticated;

CREATE FUNCTION wic_test.save_direct(n integer, expected text, new_code text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p uuid:=md5('pr1'||n)::uuid; i uuid:=md5('item'||n)::uuid;
  v uuid:=md5('validation'||n)::uuid; line uuid:=md5('line'||n)::uuid; saved text; actor text;
BEGIN
  SELECT x.full_name INTO actor FROM public.profiles x JOIN public.roles r ON r.id=x.role_id
    WHERE x.id=auth.uid() AND x.active AND r.name='warehouse';
  IF NOT FOUND THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
  IF expected IS NULL OR new_code IS NULL THEN RAISE EXCEPTION 'null code' USING ERRCODE='22004'; END IF;
  PERFORM public.wic_lock_pr1(p);
  IF NOT EXISTS(SELECT 1 FROM public.pr1_requests r JOIN public.warehouse_validations w ON w.pr1_id=r.id
    JOIN public.warehouse_validation_items x ON x.validation_id=w.id
    WHERE r.id=p AND w.id=v AND x.id=line AND x.pr1_item_id=i AND r.status='approved_for_warehouse'
      AND r.request_type IN ('goods','services') AND w.decision IS NULL)
    OR EXISTS(SELECT 1 FROM public.pr2_requests r WHERE r.pr1_id=p) THEN
    RAISE EXCEPTION 'ineligible' USING ERRCODE='55000';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pr1_items x WHERE x.id=i AND x.pr1_id=p AND x.item_code=expected) THEN
    RAISE EXCEPTION 'stale' USING ERRCODE='40001';
  END IF;
  saved:=btrim(new_code,' ');
  IF saved=expected THEN RETURN saved; END IF;
  -- Preserve only the affected code for already-existing legacy/missing-document lines.
  INSERT INTO wic_test.rfq_history SELECT b.id,i,expected FROM public.rfq_batches b WHERE b.pr1_id=p
    ON CONFLICT DO NOTHING;
  UPDATE public.pr1_items SET item_code=saved WHERE id=i AND pr1_id=p AND item_code=expected;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale' USING ERRCODE='40001'; END IF;
  UPDATE public.warehouse_validation_items SET item_code=saved
    WHERE id=line AND validation_id=v AND pr1_item_id=i;
  IF NOT FOUND THEN RAISE EXCEPTION 'validation removed' USING ERRCODE='55000'; END IF;
  INSERT INTO public.warehouse_item_code_corrections(pr1_id,validation_id,validation_item_id,pr1_item_id,
    original_pr1_code,previous_code,new_code,actor_id,actor_name_snapshot)
    VALUES(p,v,line,i,expected,expected,saved,auth.uid(),actor);
  RETURN saved;
END $$;
REVOKE ALL ON FUNCTION wic_test.save_direct(integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION wic_test.save_direct(integer,text,text) TO authenticated;

-- Replace nothing in public here: this probe only shows the required fresh INSERT read.
CREATE FUNCTION wic_test.pr2_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p uuid;
BEGIN
  SELECT r.pr1_id INTO p FROM public.pr2_requests r WHERE r.id=NEW.pr2_id;
  IF p IS NULL OR NEW.pr1_item_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.wic_lock_pr1(p);
  SELECT i.item_code INTO NEW.item_code FROM public.pr1_items i WHERE i.id=NEW.pr1_item_id AND i.pr1_id=p;
  IF NOT FOUND THEN RAISE EXCEPTION 'wrong item'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER z_probe_pr2 BEFORE INSERT ON public.pr2_items FOR EACH ROW EXECUTE FUNCTION wic_test.pr2_code();

CREATE FUNCTION wic_test.rfq_capture() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p uuid;
BEGIN
  IF TG_OP='UPDATE' THEN
    FOR p IN SELECT DISTINCT x FROM unnest(ARRAY[OLD.pr1_id,NEW.pr1_id]) x WHERE x IS NOT NULL ORDER BY x
      LOOP PERFORM public.wic_lock_pr1(p); END LOOP;
  END IF;
  IF NEW.pr1_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.wic_lock_pr1(NEW.pr1_id);
  -- Capture source PR2 lines preferentially, fallback missing/unlinked lines at document creation.
  INSERT INTO wic_test.rfq_history
    SELECT NEW.id,i.id,coalesce(d.item_code,i.item_code) FROM public.pr1_items i
    LEFT JOIN public.pr2_items d ON d.pr2_id=NEW.pr2_id AND d.pr1_item_id=i.id
    WHERE i.pr1_id=NEW.pr1_id ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER probe_rfq BEFORE INSERT OR UPDATE OF pr1_id,pr2_id ON public.rfq_batches
  FOR EACH ROW EXECUTE FUNCTION wic_test.rfq_capture();

CREATE FUNCTION wic_test.rfq_code(r uuid,i uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE p uuid; doc uuid; result text; hits integer;
BEGIN
  SELECT b.pr1_id,b.pr2_id INTO p,doc FROM public.rfq_batches b WHERE b.id=r;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.pr1_items x WHERE x.id=i AND x.pr1_id=p) THEN
    RAISE EXCEPTION 'wrong document' USING ERRCODE='55000'; END IF;
  IF doc IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.pr2_requests x WHERE x.id=doc AND x.pr1_id=p) THEN
      SELECT count(*),min(x.item_code) INTO hits,result FROM public.pr2_items x WHERE x.pr2_id=doc AND x.pr1_item_id=i;
    ELSIF EXISTS(SELECT 1 FROM public.pr2_requests_archive x WHERE x.id=doc AND x.pr1_id=p) THEN
      SELECT count(*),min(x.item_code) INTO hits,result FROM public.pr2_items_archive x WHERE x.pr2_id=doc AND x.pr1_item_id=i;
    ELSE RAISE EXCEPTION 'missing linked document' USING ERRCODE='55000'; END IF;
    IF hits>1 THEN RAISE EXCEPTION 'ambiguous line' USING ERRCODE='55000'; END IF;
    IF hits=1 THEN RETURN result; END IF;
  END IF;
  SELECT h.item_code INTO result FROM wic_test.rfq_history h WHERE h.rfq_id=r AND h.pr1_item_id=i;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing history' USING ERRCODE='55000'; END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION wic_test.pr2_code(),wic_test.rfq_capture(),wic_test.rfq_code(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
