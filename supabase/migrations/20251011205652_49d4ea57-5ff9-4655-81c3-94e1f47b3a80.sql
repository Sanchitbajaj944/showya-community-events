-- Fix the profiles_public view to use SECURITY INVOKER mode
-- This ensures the view respects RLS policies of the querying user
ALTER VIEW public.profiles_public SET (security_invoker = on);