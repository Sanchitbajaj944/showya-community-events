-- Fix the RLS policy for report creation - correct the duplicate report check
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;

CREATE POLICY "Users can create reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reporter_id
  AND auth.uid() != target_user_id  -- Can't report yourself
  AND NOT EXISTS (
    SELECT 1 FROM reports
    WHERE reporter_id = auth.uid()
      AND target_user_id = reports.target_user_id
      AND created_at > now() - INTERVAL '24 hours'
  )
);