-- Fix the security definer view issue by recreating the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  created_at,
  updated_at,
  name,
  display_name,
  bio,
  profile_picture_url,
  skills,
  city
FROM public.profiles;

-- Grant SELECT on the view
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;