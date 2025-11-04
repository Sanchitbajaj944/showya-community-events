-- Create a helper function to check if user has recently reported a target
CREATE OR REPLACE FUNCTION public.has_recent_report(_reporter_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM reports
    WHERE reporter_id = _reporter_id
      AND target_user_id = _target_user_id
      AND created_at > now() - INTERVAL '24 hours'
  )
$$;

-- Recreate the policy using the helper function
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;

CREATE POLICY "Users can create reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reporter_id
  AND auth.uid() != target_user_id
  AND NOT public.has_recent_report(auth.uid(), target_user_id)
);