-- Fix event_participants RLS to protect payment information
-- Community members should only see basic participation info, not payment details

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Community members can view event participants" ON event_participants;

-- Create a view for public participant data (no sensitive payment info)
CREATE OR REPLACE VIEW event_participants_public AS
SELECT 
  id,
  event_id,
  user_id,
  role,
  joined_at
FROM event_participants;

-- Create new restrictive policies

-- 1. Users can always see their own full participation record (including payment info)
-- (Already exists: "Users can view their own participation")

-- 2. Event creators can see full details of participants in their events
CREATE POLICY "Event creators can view all participant details"
  ON event_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_participants.event_id
      AND e.created_by = auth.uid()
    )
  );

-- 3. Community members can only see basic info (via the view or a function)
-- We'll use a SECURITY DEFINER function for this

CREATE OR REPLACE FUNCTION get_event_participants_basic(_event_id uuid)
RETURNS TABLE(
  id uuid,
  event_id uuid,
  user_id uuid,
  role participant_role,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ep.id,
    ep.event_id,
    ep.user_id,
    ep.role,
    ep.joined_at
  FROM event_participants ep
  JOIN events e ON e.id = ep.event_id
  JOIN community_members cm ON cm.community_id = e.community_id
  WHERE ep.event_id = _event_id
  AND cm.user_id = auth.uid();
$$;