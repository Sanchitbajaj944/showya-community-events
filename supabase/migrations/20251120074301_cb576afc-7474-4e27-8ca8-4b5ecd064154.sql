
-- Backfill: Add existing event participants to their event's communities
INSERT INTO public.community_members (community_id, user_id, role)
SELECT DISTINCT 
  e.community_id,
  ep.user_id,
  'member' as role
FROM public.event_participants ep
JOIN public.events e ON e.id = ep.event_id
WHERE e.community_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.community_members cm 
    WHERE cm.community_id = e.community_id 
      AND cm.user_id = ep.user_id
  )
ON CONFLICT (community_id, user_id) DO NOTHING;

-- Create trigger function to auto-add event participants to community
CREATE OR REPLACE FUNCTION public.add_event_participant_to_community()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only add to community if event has a community_id
  IF EXISTS (
    SELECT 1 FROM events 
    WHERE id = NEW.event_id 
      AND community_id IS NOT NULL
  ) THEN
    INSERT INTO community_members (community_id, user_id, role)
    SELECT community_id, NEW.user_id, 'member'
    FROM events
    WHERE id = NEW.event_id
    ON CONFLICT (community_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-add participants to community
DROP TRIGGER IF EXISTS auto_add_to_community ON public.event_participants;
CREATE TRIGGER auto_add_to_community
  AFTER INSERT ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.add_event_participant_to_community();
