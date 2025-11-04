-- Update get_reports_admin function to properly display reporter and target names
DROP FUNCTION IF EXISTS public.get_reports_admin(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_reports_admin(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  reporter_id uuid,
  reporter_name text,
  target_user_id uuid,
  target_name text,
  target_type text,
  reason text,
  message text,
  context_type text,
  context_id uuid,
  status text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.reporter_id,
    COALESCE(rp.display_name, rp.name, 'Unknown User') AS reporter_name,
    r.target_user_id,
    COALESCE(tp.display_name, tp.name, 'Unknown User') AS target_name,
    r.target_type::text,
    r.reason,
    r.message,
    r.context_type::text,
    r.context_id,
    r.status::text,
    r.created_at
  FROM reports r
  LEFT JOIN profiles rp ON rp.user_id = r.reporter_id
  LEFT JOIN profiles tp ON tp.user_id = r.target_user_id
  WHERE (p_status IS NULL OR r.status::text = p_status)
    AND public.is_admin(auth.uid())
  ORDER BY r.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;