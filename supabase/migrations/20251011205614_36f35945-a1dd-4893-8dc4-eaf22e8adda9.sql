-- First, update the profiles table RLS policy to restrict access to owner only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Create a view for public profile information (non-sensitive data only)
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  user_id,
  name,
  display_name,
  bio,
  profile_picture_url,
  skills,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;

-- Add a comment to document what fields are public vs private
COMMENT ON VIEW public.profiles_public IS 'Public profile information. Private fields (phone, address details) are not exposed.';
COMMENT ON COLUMN public.profiles.phone IS 'PRIVATE: Only visible to profile owner';
COMMENT ON COLUMN public.profiles.street1 IS 'PRIVATE: Only visible to profile owner';
COMMENT ON COLUMN public.profiles.street2 IS 'PRIVATE: Only visible to profile owner';
COMMENT ON COLUMN public.profiles.city IS 'PRIVATE: Only visible to profile owner';
COMMENT ON COLUMN public.profiles.state IS 'PRIVATE: Only visible to profile owner';
COMMENT ON COLUMN public.profiles.postal_code IS 'PRIVATE: Only visible to profile owner';