-- Create a function to get event details with conditional meeting_url access
CREATE OR REPLACE FUNCTION public.get_event_details(_event_id uuid, _user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  event_date timestamp with time zone,
  location text,
  city text,
  community_id uuid,
  community_name text,
  category text,
  created_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  price numeric,
  ticket_type text,
  duration integer,
  poster_url text,
  performer_slots integer,
  performer_ticket_price numeric,
  audience_enabled boolean,
  audience_slots integer,
  audience_ticket_price numeric,
  meeting_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    e.id,
    e.title,
    e.description,
    e.event_date,
    e.location,
    e.city,
    e.community_id,
    e.community_name,
    e.category,
    e.created_by,
    e.created_at,
    e.updated_at,
    e.price,
    e.ticket_type,
    e.duration,
    e.poster_url,
    e.performer_slots,
    e.performer_ticket_price,
    e.audience_enabled,
    e.audience_slots,
    e.audience_ticket_price,
    -- Only return meeting_url if user is registered for the event
    CASE 
      WHEN _user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.event_participants ep 
        WHERE ep.event_id = _event_id AND ep.user_id = _user_id
      ) THEN e.meeting_url
      ELSE NULL
    END as meeting_url
  FROM public.events e
  WHERE e.id = _event_id;
$$;