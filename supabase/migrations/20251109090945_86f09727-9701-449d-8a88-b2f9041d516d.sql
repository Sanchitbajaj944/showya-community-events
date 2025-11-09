-- Drop the incorrect INSERT policy
DROP POLICY IF EXISTS "Users can create their own spotlights" ON public.spotlights;

-- Create correct INSERT policy for community owners only
CREATE POLICY "Community owners can create spotlights" 
ON public.spotlights 
FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT c.owner_id
    FROM communities c
    JOIN events e ON e.community_id = c.id
    WHERE e.id = spotlights.event_id
  )
);