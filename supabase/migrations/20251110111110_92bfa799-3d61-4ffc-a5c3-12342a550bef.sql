-- Add language preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN preferred_language text DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'ur', 'kn', 'ml', 'or'));

-- Create index for faster language-based queries
CREATE INDEX idx_profiles_preferred_language ON public.profiles(preferred_language);

COMMENT ON COLUMN public.profiles.preferred_language IS 'User preferred language: en=English, hi=Hindi, bn=Bengali, mr=Marathi, te=Telugu, ta=Tamil, gu=Gujarati, ur=Urdu, kn=Kannada, ml=Malayalam, or=Odia';