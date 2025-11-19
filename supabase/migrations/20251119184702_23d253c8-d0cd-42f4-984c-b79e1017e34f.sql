-- Create function to get event participant counts (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_event_participant_counts(_event_id uuid)
RETURNS TABLE(performer_count integer, audience_count integer, total_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(*) FILTER (WHERE role = 'performer')::integer AS performer_count,
    COUNT(*) FILTER (WHERE role = 'audience')::integer AS audience_count,
    COUNT(*)::integer AS total_count
  FROM public.event_participants
  WHERE event_id = _event_id;
$$;