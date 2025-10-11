-- Fix the event_participants security issue
-- Restrict ticket code access to authenticated community members only

DROP POLICY IF EXISTS "Event participants are viewable by everyone" ON public.event_participants;

-- Allow authenticated users who are members of the community to view participants
CREATE POLICY "Community members can view event participants"
ON public.event_participants
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM events e
    JOIN community_members cm ON cm.community_id = e.community_id
    WHERE e.id = event_participants.event_id
    AND cm.user_id = auth.uid()
  )
);

-- Users can always view their own participation
CREATE POLICY "Users can view their own participation"
ON public.event_participants
FOR SELECT
USING (auth.uid() = user_id);