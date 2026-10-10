-- Disposable local PostgreSQL cluster ONLY. Synthetic minimal workflow schema.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE SCHEMA wic_test;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
   nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth, public, wic_test TO anon, authenticated;
CREATE TABLE public.roles(id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, role_id uuid REFERENCES public.roles,
 full_name text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE FUNCTION public.is_role(p_role_name text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
 WHERE p.id=auth.uid() AND r.name=p_role_name)
$$;
CREATE TABLE public.pr1_requests(id uuid PRIMARY KEY, status text NOT NULL, request_type text NOT NULL,
 requisitioner_id uuid DEFAULT md5('employee')::uuid, updated_at timestamptz DEFAULT now(), pr1_number text);
CREATE TABLE public.pr1_items(id uuid PRIMARY KEY, pr1_id uuid NOT NULL REFERENCES public.pr1_requests,
 item_code text NOT NULL, description text DEFAULT 'unchanged');
CREATE TABLE public.warehouse_validations(id uuid PRIMARY KEY,
 pr1_id uuid NOT NULL UNIQUE REFERENCES public.pr1_requests, decision text);
CREATE TABLE public.warehouse_validation_items(id uuid PRIMARY KEY,
 validation_id uuid NOT NULL REFERENCES public.warehouse_validations ON DELETE CASCADE,
 pr1_item_id uuid NOT NULL REFERENCES public.pr1_items, item_code text NOT NULL,
 UNIQUE(validation_id,pr1_item_id));
CREATE TABLE public.pr2_requests(id uuid PRIMARY KEY,pr1_id uuid REFERENCES public.pr1_requests,
 status text NOT NULL DEFAULT 'draft',request_type text NOT NULL DEFAULT 'goods');
CREATE TABLE public.pr2_items(id uuid PRIMARY KEY,pr2_id uuid NOT NULL REFERENCES public.pr2_requests,
 pr1_item_id uuid REFERENCES public.pr1_items,item_code text NOT NULL);
CREATE TABLE public.rfq_batches(id uuid PRIMARY KEY,pr1_id uuid,pr2_id uuid);
CREATE TABLE public.rfq_suppliers(id uuid PRIMARY KEY,rfq_id uuid,supplier_id uuid);
-- Models the existing document-access boundary; not a production policy clone.
CREATE TABLE wic_test.document_access(actor_id uuid,pr1_id uuid);
CREATE FUNCTION public.can_read_pr1(p_pr1_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.is_role('warehouse') OR public.is_role('procurement') OR EXISTS (
   SELECT 1 FROM wic_test.document_access a WHERE a.actor_id=auth.uid() AND a.pr1_id=p_pr1_id)
$$;
INSERT INTO public.roles SELECT md5(x)::uuid,x FROM unnest(
 ARRAY['warehouse','admin','employee','procurement','approver','supplier']) x;
INSERT INTO public.profiles SELECT md5(x)::uuid,md5(x)::uuid,x,true FROM unnest(
 ARRAY['warehouse','admin','employee','procurement','approver','supplier']) x;
INSERT INTO public.profiles VALUES(md5('inactive')::uuid,md5('warehouse')::uuid,'inactive',false);
INSERT INTO public.profiles VALUES(md5('other-employee')::uuid,md5('employee')::uuid,'Other Employee',true);
INSERT INTO public.pr1_requests(id,status,request_type) SELECT md5('pr1'||n)::uuid,'approved_for_warehouse','goods'
 FROM generate_series(1,40) n;
INSERT INTO public.pr1_items SELECT md5('item'||n)::uuid,md5('pr1'||n)::uuid,'001-ORIGINAL'
 FROM generate_series(1,40) n;
INSERT INTO public.warehouse_validations SELECT md5('validation'||n)::uuid,md5('pr1'||n)::uuid,null
 FROM generate_series(1,40) n;
INSERT INTO public.warehouse_validation_items SELECT md5('line'||n)::uuid,
 md5('validation'||n)::uuid,md5('item'||n)::uuid,'001-ORIGINAL' FROM generate_series(1,40) n;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
CREATE TABLE public.audit_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,payload jsonb NOT NULL);
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT USAGE ON SEQUENCE public.audit_logs_id_seq TO authenticated;
CREATE FUNCTION wic_test.assert(p_ok boolean,p_message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'TEST FAILED: %',p_message; END IF; END;
$$;
CREATE FUNCTION wic_test.expect_error(p_sql text,p_state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
   IF SQLSTATE=p_state THEN RETURN; END IF;
   RAISE EXCEPTION 'Wrong SQLSTATE: expected %, got % (%)',p_state,SQLSTATE,SQLERRM;
 END;
 RAISE EXCEPTION 'Expected SQLSTATE %, statement succeeded',p_state;
END;
$$;
