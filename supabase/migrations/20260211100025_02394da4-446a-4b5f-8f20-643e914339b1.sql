
-- 1. Add unique constraint to prevent duplicate bookings
ALTER TABLE public.event_participants
  ADD CONSTRAINT uq_event_user_role UNIQUE (event_id, user_id, role);

-- 2. Atomic booking function with slot check + duplicate prevention
CREATE OR REPLACE FUNCTION public.book_event_participant(
  p_event_id uuid,
  p_user_id uuid,
  p_role text,
  p_ticket_code text,
  p_payment_status text DEFAULT 'free',
  p_amount_paid numeric DEFAULT 0,
  p_razorpay_payment_id text DEFAULT NULL,
  p_razorpay_order_id text DEFAULT NULL,
  p_mic_permission text DEFAULT 'none'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event record;
  v_performer_count int;
  v_audience_count int;
  v_max_slots int;
  v_result jsonb;
BEGIN
  -- Lock the event row to prevent race conditions
  SELECT * INTO v_event
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.is_cancelled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event is cancelled');
  END IF;

  -- Check for existing booking with same role
  IF EXISTS (
    SELECT 1 FROM event_participants
    WHERE event_id = p_event_id AND user_id = p_user_id AND role = p_role::participant_role
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already booked this role.');
  END IF;

  -- Get current counts
  SELECT
    COUNT(*) FILTER (WHERE role = 'performer'),
    COUNT(*) FILTER (WHERE role = 'audience')
  INTO v_performer_count, v_audience_count
  FROM event_participants
  WHERE event_id = p_event_id;

  -- Check slot availability
  IF p_role = 'performer' THEN
    IF v_performer_count >= v_event.performer_slots THEN
      RETURN jsonb_build_object('success', false, 'error', 'No performer slots available');
    END IF;
  ELSIF p_role = 'audience' THEN
    v_max_slots := COALESCE(v_event.audience_slots, 50);
    IF v_audience_count >= v_max_slots THEN
      RETURN jsonb_build_object('success', false, 'error', 'No audience slots available');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
  END IF;

  -- Insert the participant
  INSERT INTO event_participants (
    event_id, user_id, role, ticket_code,
    payment_status, amount_paid,
    razorpay_payment_id, razorpay_order_id,
    mic_permission
  ) VALUES (
    p_event_id, p_user_id, p_role::participant_role, p_ticket_code,
    p_payment_status, p_amount_paid,
    p_razorpay_payment_id, p_razorpay_order_id,
    p_mic_permission
  );

  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already booked this role.');
END;
$$;
