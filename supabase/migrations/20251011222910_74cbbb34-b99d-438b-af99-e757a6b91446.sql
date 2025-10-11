-- Fix infinite recursion in community_members RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Community members can view their community members" ON public.community_members;
DROP POLICY IF EXISTS "Community owners can view all members" ON public.community_members;

-- Create security definer function to check if user is a community member
CREATE OR REPLACE FUNCTION public.is_community_member(_user_id uuid, _community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members
    WHERE user_id = _user_id
      AND community_id = _community_id
  )
$$;

-- Create security definer function to check if user is community owner
CREATE OR REPLACE FUNCTION public.is_community_owner(_user_id uuid, _community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.communities
    WHERE id = _community_id
      AND owner_id = _user_id
  )
$$;

-- Create new policies using security definer functions
CREATE POLICY "Members can view community members"
ON public.community_members
FOR SELECT
TO authenticated
USING (
  public.is_community_member(auth.uid(), community_id)
  OR public.is_community_owner(auth.uid(), community_id)
);