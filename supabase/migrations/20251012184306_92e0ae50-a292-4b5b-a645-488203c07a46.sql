-- Allow community members to view basic profile info of other community members
CREATE POLICY "Community members can view other members' public profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_members cm1
    JOIN public.community_members cm2 ON cm1.community_id = cm2.community_id
    WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = profiles.user_id
  )
);