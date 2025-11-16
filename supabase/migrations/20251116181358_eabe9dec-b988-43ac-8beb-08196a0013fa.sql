-- Add trigger for reel likes notification
CREATE OR REPLACE FUNCTION public.notify_reel_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Notify community owner when someone likes their reel
  INSERT INTO public.notifications (user_id, title, message, type, category, related_id, action_url)
  SELECT 
    s.user_id,
    'Reel Liked',
    'Someone liked your reel',
    'info',
    'reel',
    NEW.spotlight_id,
    '/reels'
  FROM spotlights s
  WHERE s.id = NEW.spotlight_id 
    AND s.user_id != NEW.user_id; -- Don't notify if user likes their own reel
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_reel_like ON public.spotlight_likes;
CREATE TRIGGER on_reel_like
  AFTER INSERT ON public.spotlight_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_reel_like();

-- Add trigger for new chat messages
CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Notify all community members except the sender
  INSERT INTO public.notifications (user_id, title, message, type, category, related_id, action_url)
  SELECT 
    cm.user_id,
    'New Message',
    (SELECT name FROM profiles WHERE user_id = NEW.user_id LIMIT 1) || ' sent a message in ' || 
    (SELECT name FROM communities WHERE id = NEW.community_id LIMIT 1),
    'info',
    'chat',
    NEW.community_id,
    '/communities/' || NEW.community_id || '?tab=chat'
  FROM community_members cm
  WHERE cm.community_id = NEW.community_id 
    AND cm.user_id != NEW.user_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_chat_message ON public.community_messages;
CREATE TRIGGER on_new_chat_message
  AFTER INSERT ON public.community_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_chat_message();