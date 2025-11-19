-- Create function to get event participants with their profiles (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_event_participants_with_profiles(_event_id uuid, _role text DEFAULT 'performer')
RETURNS TABLE(
  user_id uuid,
  name text,
  display_name text,
  profile_picture_url text,
  bio text,
  skills text[],
  joined_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    p.name,
    p.display_name,
    p.profile_picture_url,
    p.bio,
    p.skills,
    ep.joined_at
  FROM public.event_participants ep
  JOIN public.profiles p ON p.user_id = ep.user_id
  WHERE ep.event_id = _event_id 
    AND ep.role::text = _role
  ORDER BY ep.joined_at ASC;
$$;