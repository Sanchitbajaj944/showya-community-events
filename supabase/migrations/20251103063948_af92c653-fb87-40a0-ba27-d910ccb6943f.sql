-- Create a public function to get community member count
-- This allows public users to see member counts without accessing the community_members table directly
CREATE OR REPLACE FUNCTION public.get_community_member_count(p_community_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM community_members
  WHERE community_id = p_community_id;
$$;

-- Grant execute permission to all users (including anonymous)
GRANT EXECUTE ON FUNCTION public.get_community_member_count(UUID) TO anon, authenticated;