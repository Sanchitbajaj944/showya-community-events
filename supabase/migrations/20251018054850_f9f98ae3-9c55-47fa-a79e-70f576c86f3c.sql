-- Fix the handle_new_user function to properly set user_id and name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, skills)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.email, 'User'),
    CASE 
      WHEN new.raw_user_meta_data->'skills' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'skills'))
      ELSE '{}'::text[]
    END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    name = COALESCE(EXCLUDED.name, profiles.name),
    skills = EXCLUDED.skills;
  
  RETURN new;
END;
$$;