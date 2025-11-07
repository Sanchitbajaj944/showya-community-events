-- Fix spotlight impersonation vulnerability
-- Replace permissive INSERT policy with user ownership check

DROP POLICY IF EXISTS "Authenticated users can create spotlights" ON public.spotlights;

CREATE POLICY "Users can create their own spotlights"
ON public.spotlights
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);