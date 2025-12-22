-- Allow community owners to view participants for events in their community
CREATE POLICY "Community owners can view event participants"
ON public.event_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN communities c ON c.id = e.community_id
    WHERE e.id = event_participants.event_id
      AND c.owner_id = auth.uid()
  )
);