-- Fix profiles_public view to bypass RLS and allow public access to non-sensitive profile data
-- The current view inherits RLS from profiles table which only allows users to see their own profile

-- Drop the existing view
DROP VIEW IF EXISTS profiles_public;

-- Recreate as a security definer view that bypasses RLS
CREATE VIEW profiles_public 
WITH (security_invoker = false)
AS
SELECT 
    id,
    user_id,
    created_at,
    updated_at,
    name,
    display_name,
    bio,
    profile_picture_url,
    skills,
    city
FROM profiles;

-- Grant select access to all roles
GRANT SELECT ON profiles_public TO authenticated;
GRANT SELECT ON profiles_public TO anon;