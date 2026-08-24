/*
  Block direct messaging between requestors (role = employee) and suppliers
  (role = supplier), per procurement's meeting decision: requestors must not
  message suppliers directly, and suppliers must not message requestors.
  Communication between the two must go through Procurement.

  All other role pairs (procurement, warehouse, tsqa, approver, admin ↔
  anyone) are unaffected. Admin is exempt from the block entirely so support
  staff can still reach any account.

  Two enforcement points, since messaging has two entry points:
   1. create_or_get_conversation — blocks starting a NEW conversation.
   2. messages INSERT RLS — blocks sending into an EXISTING conversation
      that predates this rule (one such conversation already exists in
      prod: an employee/supplier pair from before this policy existed).
      Existing conversation rows are left alone (conversations are
      permanent per the original design), but no further messages can be
      sent through them.
*/

CREATE OR REPLACE FUNCTION public.is_requestor_supplier_pair(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pa
    JOIN public.roles ra ON ra.id = pa.role_id
    JOIN public.profiles pb ON pb.id = user_b
    JOIN public.roles rb ON rb.id = pb.role_id
    WHERE pa.id = user_a
      AND (
        (ra.name = 'employee' AND rb.name = 'supplier')
        OR (ra.name = 'supplier' AND rb.name = 'employee')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_requestor_supplier_pair(uuid, uuid) TO authenticated;

-- ─── 1. Conversation creation ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_or_get_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_a uuid;
  user_b uuid;
  conv_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  IF public.is_requestor_supplier_pair(current_user_id, other_user_id) THEN
    RAISE EXCEPTION 'Requestors and suppliers cannot message each other directly. Please route communication through Procurement.';
  END IF;

  IF current_user_id < other_user_id THEN
    user_a := current_user_id;
    user_b := other_user_id;
  ELSE
    user_a := other_user_id;
    user_b := current_user_id;
  END IF;

  SELECT id INTO conv_id
  FROM conversations
  WHERE user_a_id = user_a AND user_b_id = user_b;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (user_a_id, user_b_id)
    VALUES (user_a, user_b)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_get_conversation(uuid) TO authenticated;

-- ─── 2. Message sending ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;

CREATE POLICY "Users can send messages to their conversations"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
    AND NOT public.is_requestor_supplier_pair(
      (SELECT c.user_a_id FROM public.conversations c WHERE c.id = messages.conversation_id),
      (SELECT c.user_b_id FROM public.conversations c WHERE c.id = messages.conversation_id)
    )
  );
