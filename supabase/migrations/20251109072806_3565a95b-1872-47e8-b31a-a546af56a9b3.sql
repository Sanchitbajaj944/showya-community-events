-- Add video support to spotlights table for reels
ALTER TABLE public.spotlights
ADD COLUMN video_url text,
ADD COLUMN caption text,
ADD COLUMN view_count integer DEFAULT 0,
ADD COLUMN like_count integer DEFAULT 0;

-- Create storage bucket for reels
INSERT INTO storage.buckets (id, name, public)
VALUES ('reels', 'reels', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for reels bucket
CREATE POLICY "Reels are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'reels');

CREATE POLICY "Community owners can upload reels"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reels' 
  AND auth.uid() IN (
    SELECT owner_id FROM communities
  )
);

CREATE POLICY "Community owners can delete their reels"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reels'
  AND auth.uid() IN (
    SELECT owner_id FROM communities
  )
);

-- Update RLS policies for spotlights to allow public viewing of reels
DROP POLICY IF EXISTS "Spotlights are viewable by everyone" ON public.spotlights;
CREATE POLICY "Spotlights are viewable by everyone"
ON public.spotlights FOR SELECT
USING (true);

-- Community owners can update their spotlights
CREATE POLICY "Community owners can update spotlights"
ON public.spotlights FOR UPDATE
USING (
  auth.uid() IN (
    SELECT c.owner_id 
    FROM communities c
    JOIN events e ON e.community_id = c.id
    WHERE e.id = spotlights.event_id
  )
);

-- Community owners can delete their spotlights
CREATE POLICY "Community owners can delete spotlights"
ON public.spotlights FOR DELETE
USING (
  auth.uid() IN (
    SELECT c.owner_id 
    FROM communities c
    JOIN events e ON e.community_id = c.id
    WHERE e.id = spotlights.event_id
  )
);

-- Add constraint to ensure one reel per event
ALTER TABLE public.spotlights
ADD CONSTRAINT unique_event_reel UNIQUE (event_id);