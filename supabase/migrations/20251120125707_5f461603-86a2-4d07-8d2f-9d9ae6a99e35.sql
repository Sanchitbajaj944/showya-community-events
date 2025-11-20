-- Allow admins to update platform_fee_percentage for any community
CREATE POLICY "Admins can update platform fee"
ON public.communities
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));