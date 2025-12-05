-- Drop the overly permissive RLS policies that expose sensitive data
DROP POLICY IF EXISTS "Community members can view other members' public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Event participants can view other participants' profiles" ON public.profiles;
DROP POLICY IF EXISTS "Community owner profiles are viewable by everyone" ON public.profiles;

-- The profiles_public view already exists and exposes only safe fields:
-- (id, user_id, created_at, updated_at, name, display_name, bio, profile_picture_url, skills)
-- Applications should use this view for viewing other users' profiles

-- Create RLS policies for the profiles_public view to allow public read access
-- First, enable RLS on the view if not already enabled (views inherit from base table)
-- The view is already created as a simple SELECT, so we need to ensure it's accessible

-- Grant SELECT on profiles_public to authenticated and anon users
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;

-- Add a comment explaining the security model
COMMENT ON TABLE public.profiles IS 'User profiles - sensitive fields (pan, phone, dob, address) only accessible to profile owner. Use profiles_public view for viewing other users.';
COMMENT ON VIEW public.profiles_public IS 'Public profile view - exposes only safe fields (name, display_name, bio, profile_picture_url, skills). Use this for viewing other users profiles.';