
-- Update handle_new_user to also store phone, gender, dob, city from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, skills, phone, gender, dob, city, preferred_language)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.email, 'User'),
    CASE 
      WHEN new.raw_user_meta_data->'skills' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'skills'))
      ELSE '{}'::text[]
    END,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender',
    CASE 
      WHEN new.raw_user_meta_data->>'dob' IS NOT NULL 
      THEN (new.raw_user_meta_data->>'dob')::date
      ELSE NULL
    END,
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'preferred_language'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    name = COALESCE(EXCLUDED.name, profiles.name),
    skills = COALESCE(EXCLUDED.skills, profiles.skills),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    gender = COALESCE(EXCLUDED.gender, profiles.gender),
    dob = COALESCE(EXCLUDED.dob, profiles.dob),
    city = COALESCE(EXCLUDED.city, profiles.city),
    preferred_language = COALESCE(EXCLUDED.preferred_language, profiles.preferred_language);
  
  RETURN new;
END;
$function$;
