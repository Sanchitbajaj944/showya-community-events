-- Add missing columns to spotlights table for ShowClips feature
ALTER TABLE public.spotlights 
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS reward_text text,
ADD COLUMN IF NOT EXISTS is_winner_spotlight boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id);

-- Create index for community_id lookups
CREATE INDEX IF NOT EXISTS idx_spotlights_community_id ON public.spotlights(community_id);

-- Create showclip_views table for unique view tracking
CREATE TABLE IF NOT EXISTS public.showclip_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showclip_id uuid NOT NULL REFERENCES public.spotlights(id) ON DELETE CASCADE,
  user_id uuid,
  session_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT unique_user_view UNIQUE NULLS NOT DISTINCT (showclip_id, user_id),
  CONSTRAINT unique_session_view UNIQUE NULLS NOT DISTINCT (showclip_id, session_id)
);

-- Enable RLS on showclip_views
ALTER TABLE public.showclip_views ENABLE ROW LEVEL SECURITY;

-- RLS policies for showclip_views
CREATE POLICY "Anyone can view showclip_views" ON public.showclip_views
FOR SELECT USING (true);

CREATE POLICY "Users can insert their own views" ON public.showclip_views
FOR INSERT WITH CHECK (
  (auth.uid() = user_id) OR 
  (user_id IS NULL AND session_id IS NOT NULL)
);

-- Create index for efficient view counting
CREATE INDEX IF NOT EXISTS idx_showclip_views_showclip_id ON public.showclip_views(showclip_id);

-- Create a function to get ranked showclips for the home feed
CREATE OR REPLACE FUNCTION public.get_ranked_showclips(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  video_url text,
  thumbnail_url text,
  caption text,
  view_count integer,
  like_count integer,
  community_name text,
  community_id uuid,
  feature_text text,
  event_id uuid,
  user_id uuid,
  reward_text text,
  is_winner_spotlight boolean,
  created_at timestamp with time zone,
  score numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id,
    s.video_url,
    s.thumbnail_url,
    s.caption,
    COALESCE(s.view_count, 0) as view_count,
    COALESCE(s.like_count, 0) as like_count,
    s.community_name,
    s.community_id,
    s.feature_text,
    s.event_id,
    s.user_id,
    s.reward_text,
    COALESCE(s.is_winner_spotlight, false) as is_winner_spotlight,
    s.created_at,
    (
      -- Recency score (decays over 7 days)
      0.4 * GREATEST(0, 1 - EXTRACT(EPOCH FROM (now() - s.created_at)) / (7 * 24 * 3600))
      -- Community size score (logarithmic)
      + 0.3 * LEAST(1, LOG(GREATEST(1, COALESCE(
        (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = s.community_id), 0
      ) + 1)) / 4)
      -- Engagement rate (likes/views ratio, capped at 1)
      + 0.3 * CASE 
        WHEN COALESCE(s.view_count, 0) > 0 
        THEN LEAST(1, COALESCE(s.like_count, 0)::numeric / s.view_count)
        ELSE 0 
      END
    )::numeric as score
  FROM spotlights s
  WHERE s.video_url IS NOT NULL
  ORDER BY score DESC, s.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Function to record a view with debounce (prevents duplicate views within session)
CREATE OR REPLACE FUNCTION public.record_showclip_view(
  p_showclip_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  view_recorded boolean := false;
BEGIN
  -- Try to insert a view record
  IF p_user_id IS NOT NULL THEN
    INSERT INTO showclip_views (showclip_id, user_id)
    VALUES (p_showclip_id, p_user_id)
    ON CONFLICT (showclip_id, user_id) DO NOTHING;
  ELSIF p_session_id IS NOT NULL THEN
    INSERT INTO showclip_views (showclip_id, session_id)
    VALUES (p_showclip_id, p_session_id)
    ON CONFLICT (showclip_id, session_id) DO NOTHING;
  END IF;
  
  -- Check if view was recorded
  GET DIAGNOSTICS view_recorded = ROW_COUNT;
  
  -- If new view, increment the cached count
  IF view_recorded THEN
    UPDATE spotlights 
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_showclip_id;
  END IF;
  
  RETURN view_recorded;
END;
$$;