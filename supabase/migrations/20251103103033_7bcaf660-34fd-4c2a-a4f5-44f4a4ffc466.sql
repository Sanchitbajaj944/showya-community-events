-- Create enum types for the reporting system
CREATE TYPE public.report_target_type AS ENUM ('user', 'community_owner');
CREATE TYPE public.report_context_type AS ENUM ('event', 'chat', 'profile', 'community');
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'resolved');

-- Create reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target_type NOT NULL,
  reason TEXT NOT NULL,
  message TEXT,
  context_type public.report_context_type,
  context_id UUID,
  status public.report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_report CHECK (reporter_id != target_user_id)
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own submitted reports
CREATE POLICY "Users can view their own reports"
ON public.reports
FOR SELECT
USING (auth.uid() = reporter_id);

-- RLS Policy: Users can create reports with rate limiting enforced
CREATE POLICY "Users can create reports"
ON public.reports
FOR INSERT
WITH CHECK (
  auth.uid() = reporter_id
  AND NOT EXISTS (
    SELECT 1 FROM public.reports
    WHERE reporter_id = auth.uid()
      AND target_user_id = reports.target_user_id
      AND created_at > NOW() - INTERVAL '24 hours'
  )
);

-- Create indexes for performance
CREATE INDEX idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX idx_reports_target_user_id ON public.reports(target_user_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX idx_reports_target_context ON public.reports(context_type, context_id);

-- Function to get report count for a user (for auto-actions)
CREATE OR REPLACE FUNCTION public.get_user_report_count(
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM reports
  WHERE target_user_id = p_user_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL
    AND status = 'pending';
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_report_count(UUID, INTEGER) TO authenticated;