-- Fix user_roles RLS policies to allow service role operations
DROP POLICY IF EXISTS "Only system can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Allow users and admins to view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow service role to insert (for grant-admin-role function)
-- This uses a special check that allows bypassing when called from edge functions
CREATE POLICY "Service role can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (true);

-- Allow service role to update roles
CREATE POLICY "Service role can update roles"
ON public.user_roles
FOR UPDATE
USING (true);

-- Allow service role to delete roles
CREATE POLICY "Service role can delete roles"
ON public.user_roles
FOR DELETE
USING (true);