
-- Allow event participants to view other participants' profiles
CREATE POLICY "Event participants can view other participants' profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM event_participants ep1
    JOIN event_participants ep2 ON ep1.event_id = ep2.event_id
    WHERE ep1.user_id = auth.uid()
      AND ep2.user_id = profiles.user_id
  )
);
