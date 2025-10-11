-- Fix community_members security issue
-- Restrict member list visibility to authenticated community members only

DROP POLICY IF EXISTS "Members are viewable by everyone" ON public.community_members;

-- Community members can view other members in the same community
CREATE POLICY "Community members can view their community members"
ON public.community_members
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM community_members cm
    WHERE cm.community_id = community_members.community_id
    AND cm.user_id = auth.uid()
  )
);

-- Anyone can view members for communities they own
CREATE POLICY "Community owners can view all members"
ON public.community_members  
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM communities c
    WHERE c.id = community_members.community_id
    AND c.owner_id = auth.uid()
  )
);