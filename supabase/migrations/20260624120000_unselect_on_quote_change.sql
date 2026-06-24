-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-unselect procurement's winner when a supplier changes that quote.
--
-- Problem: when procurement has already selected a supplier's quote as the
-- winner for an RFQ line, and that supplier later edits & resubmits the quote
-- (new price, product, lead time, etc.), the stale selection stays in place.
-- Procurement could generate a PR2 from a quote that no longer reflects what
-- they reviewed.
--
-- This must run server-side with elevated privileges: RLS on
-- supplier_item_selections only allows the `procurement` role to SELECT/DELETE,
-- so the supplier's own session (which performs the quote upsert) cannot clear
-- the selection. A SECURITY DEFINER trigger on rfq_item_quotes does it
-- atomically and also notifies procurement that a reselection is required.
--
-- Statement-level (with transition tables) so a multi-line resubmit produces a
-- single procurement notification rather than one per changed line.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.unselect_selections_on_quote_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec             record;
  v_rfq_id        uuid;
  v_supplier_id   uuid;
  v_count         integer := 0;
  v_rfq_number    text;
  v_supplier_name text;
BEGIN
  -- Delete selections whose chosen supplier materially changed their quote for
  -- the same PR1 line. "Material" excludes a no-op resubmit (identical values).
  FOR rec IN
    DELETE FROM supplier_item_selections s
    USING (
      SELECT n.rfq_supplier_id, n.pr1_item_id
      FROM new_quotes n
      JOIN old_quotes o
        ON o.rfq_supplier_id = n.rfq_supplier_id
       AND o.pr1_item_id     = n.pr1_item_id
      WHERE n.unit_price          IS DISTINCT FROM o.unit_price
         OR n.supplier_product_id IS DISTINCT FROM o.supplier_product_id
         OR n.quoted_description  IS DISTINCT FROM o.quoted_description
         OR n.lead_time_days      IS DISTINCT FROM o.lead_time_days
         OR n.is_alternative      IS DISTINCT FROM o.is_alternative
         OR n.response_status     IS DISTINCT FROM o.response_status
         OR n.no_quote_reason     IS DISTINCT FROM o.no_quote_reason
    ) c
    WHERE s.selected_rfq_supplier_id = c.rfq_supplier_id
      AND s.pr1_item_id              = c.pr1_item_id
    RETURNING s.rfq_id, s.selected_rfq_supplier_id
  LOOP
    v_rfq_id      := rec.rfq_id;
    v_supplier_id := rec.selected_rfq_supplier_id;
    v_count       := v_count + 1;
  END LOOP;

  IF v_count > 0 AND v_rfq_id IS NOT NULL THEN
    SELECT rfq_number          INTO v_rfq_number   FROM rfq_batches   WHERE id = v_rfq_id;
    SELECT supplier_name_snapshot INTO v_supplier_name FROM rfq_suppliers WHERE id = v_supplier_id;

    INSERT INTO notifications (user_id, title, body, type, document_type, document_id, action_url, read)
    SELECT
      p.id,
      'Quote Updated — Reselection Required',
      COALESCE(v_supplier_name, 'A supplier')
        || ' updated a quote for ' || COALESCE(v_rfq_number, 'an RFQ')
        || '. ' || v_count || ' previously selected line'
        || CASE WHEN v_count = 1 THEN ' was' ELSE 's were' END
        || ' unselected. Please review and reselect.',
      'action_required',
      'rfq',
      v_rfq_id,
      '/rfq/' || v_rfq_id::text,
      false
    FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE r.name = 'procurement';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_unselect_on_quote_change ON public.rfq_item_quotes;

CREATE TRIGGER trg_unselect_on_quote_change
AFTER UPDATE ON public.rfq_item_quotes
REFERENCING OLD TABLE AS old_quotes NEW TABLE AS new_quotes
FOR EACH STATEMENT
EXECUTE FUNCTION public.unselect_selections_on_quote_change();
