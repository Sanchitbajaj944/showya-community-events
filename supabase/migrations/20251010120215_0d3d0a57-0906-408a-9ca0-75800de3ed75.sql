-- Add skills column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- Create index for better query performance on skills
CREATE INDEX IF NOT EXISTS idx_profiles_skills ON public.profiles USING GIN(skills);

-- Update the handle_new_user function to include skills
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, skills)
  VALUES (new.id, COALESCE((new.raw_user_meta_data->>'skills')::text[], '{}'))
  ON CONFLICT (id) DO UPDATE
  SET skills = COALESCE((new.raw_user_meta_data->>'skills')::text[], '{}');
  RETURN new;
END;
$$;