-- Allow everyone to view all profiles (for community features)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);