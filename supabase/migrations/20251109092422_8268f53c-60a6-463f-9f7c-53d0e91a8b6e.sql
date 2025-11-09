-- Create table to track spotlight likes
CREATE TABLE IF NOT EXISTS public.spotlight_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spotlight_id UUID NOT NULL REFERENCES public.spotlights(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(spotlight_id, user_id)
);

-- Enable RLS
ALTER TABLE public.spotlight_likes ENABLE ROW LEVEL SECURITY;

-- Allow users to view all likes
CREATE POLICY "Likes are viewable by everyone"
ON public.spotlight_likes
FOR SELECT
USING (true);

-- Users can only insert their own likes
CREATE POLICY "Users can like spotlights"
ON public.spotlight_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own likes
CREATE POLICY "Users can unlike spotlights"
ON public.spotlight_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_spotlight_likes_spotlight_id ON public.spotlight_likes(spotlight_id);
CREATE INDEX idx_spotlight_likes_user_id ON public.spotlight_likes(user_id);

-- Function to update like count on spotlights table
CREATE OR REPLACE FUNCTION update_spotlight_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.spotlights 
    SET like_count = like_count + 1 
    WHERE id = NEW.spotlight_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.spotlights 
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.spotlight_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to automatically update like counts
CREATE TRIGGER update_spotlight_likes_count
AFTER INSERT OR DELETE ON public.spotlight_likes
FOR EACH ROW
EXECUTE FUNCTION update_spotlight_like_count();