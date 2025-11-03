-- Enable realtime for community messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_community_messages_community_created 
ON public.community_messages(community_id, created_at DESC);

-- Add index for user lookups
CREATE INDEX IF NOT EXISTS idx_community_messages_user 
ON public.community_messages(user_id);

-- Function to check message rate limiting (max 10 messages per minute per user)
CREATE OR REPLACE FUNCTION public.check_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO message_count
  FROM public.community_messages
  WHERE user_id = NEW.user_id
    AND community_id = NEW.community_id
    AND created_at > NOW() - INTERVAL '1 minute';
  
  IF message_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more messages.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for rate limiting
DROP TRIGGER IF EXISTS enforce_message_rate_limit ON public.community_messages;
CREATE TRIGGER enforce_message_rate_limit
  BEFORE INSERT ON public.community_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_message_rate_limit();

-- Add constraint for message length (max 2000 characters)
ALTER TABLE public.community_messages
DROP CONSTRAINT IF EXISTS community_messages_content_length;

ALTER TABLE public.community_messages
ADD CONSTRAINT community_messages_content_length
CHECK (char_length(content) > 0 AND char_length(content) <= 2000);