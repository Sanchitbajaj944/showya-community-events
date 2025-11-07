-- Add explicit search_path to all SECURITY DEFINER functions
-- This prevents search_path injection attacks

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.add_owner_as_member() SET search_path = public;
ALTER FUNCTION public.sync_community_kyc_status() SET search_path = public;