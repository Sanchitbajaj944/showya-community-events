
-- Add blue tick columns to communities table
ALTER TABLE public.communities 
  ADD COLUMN is_blue_tick boolean NOT NULL DEFAULT false,
  ADD COLUMN blue_tick_granted_at timestamptz,
  ADD COLUMN blue_tick_note text;

-- RLS: Only admins can update blue_tick fields
-- We need a policy that prevents non-admins from updating blue_tick columns
-- Since communities already has RLS, we add a specific policy for blue tick updates
CREATE POLICY "Only admins can update blue tick fields"
ON public.communities
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is owner (existing behavior) OR admin
  owner_id = auth.uid() OR public.is_admin(auth.uid())
)
WITH CHECK (
  -- If blue tick fields are being changed, must be admin
  -- If not admin, blue tick fields must remain unchanged
  public.is_admin(auth.uid()) OR (
    -- Non-admin: ensure blue tick fields aren't changed
    -- This is enforced via a trigger instead since WITH CHECK can't compare OLD values
    owner_id = auth.uid()
  )
);

-- Create trigger to prevent non-admins from modifying blue tick fields
CREATE OR REPLACE FUNCTION public.protect_blue_tick_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If blue tick fields are being changed, check admin status
  IF (NEW.is_blue_tick IS DISTINCT FROM OLD.is_blue_tick OR
      NEW.blue_tick_granted_at IS DISTINCT FROM OLD.blue_tick_granted_at OR
      NEW.blue_tick_note IS DISTINCT FROM OLD.blue_tick_note) THEN
    IF NOT public.is_admin(auth.uid()) THEN
      -- Reset blue tick fields to old values
      NEW.is_blue_tick := OLD.is_blue_tick;
      NEW.blue_tick_granted_at := OLD.blue_tick_granted_at;
      NEW.blue_tick_note := OLD.blue_tick_note;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_blue_tick_fields_trigger
BEFORE UPDATE ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.protect_blue_tick_fields();

-- Update the showclips ranking function with blue tick boost (1.05x)
CREATE OR REPLACE FUNCTION public.get_ranked_showclips(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid, video_url text, thumbnail_url text, caption text, 
  view_count integer, like_count integer, community_name text, 
  community_id uuid, feature_text text, event_id uuid, user_id uuid, 
  reward_text text, is_winner_spotlight boolean, created_at timestamptz, score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
      )
      -- Blue tick boost: 1.05x multiplier for verified communities
      * CASE 
        WHEN EXISTS (SELECT 1 FROM communities c WHERE c.id = s.community_id AND c.is_blue_tick = true)
        THEN 1.05
        ELSE 1.0
      END
    )::numeric as score
  FROM spotlights s
  WHERE s.video_url IS NOT NULL
  ORDER BY score DESC, s.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
