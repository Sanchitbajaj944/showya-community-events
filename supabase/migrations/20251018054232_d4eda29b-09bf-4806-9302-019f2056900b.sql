-- Fix the handle_new_user function to properly parse JSON array to PostgreSQL array
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Parse the skills from JSON to PostgreSQL array
  INSERT INTO public.profiles (id, skills)
  VALUES (
    new.id, 
    CASE 
      WHEN new.raw_user_meta_data->>'skills' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text((new.raw_user_meta_data->>'skills')::jsonb))
      ELSE '{}'::text[]
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET skills = CASE 
      WHEN new.raw_user_meta_data->>'skills' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text((new.raw_user_meta_data->>'skills')::jsonb))
      ELSE '{}'::text[]
    END;
  RETURN new;
END;
$$;