-- Allow viewing profiles of community owners (public information)
CREATE POLICY "Community owner profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE communities.owner_id = profiles.user_id
  )
);