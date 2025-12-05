-- Create a separate table for sensitive KYC data
-- This separates PII from the general profile data for defense in depth

CREATE TABLE public.profile_kyc_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  street1 text,
  street2 text,
  city text,
  state text,
  postal_code text,
  pan text,
  dob date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_kyc_data ENABLE ROW LEVEL SECURITY;

-- Only the user can view their own KYC data
CREATE POLICY "Users can view their own KYC data"
ON public.profile_kyc_data FOR SELECT
USING (auth.uid() = user_id);

-- Only the user can insert their own KYC data
CREATE POLICY "Users can insert their own KYC data"
ON public.profile_kyc_data FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only the user can update their own KYC data
CREATE POLICY "Users can update their own KYC data"
ON public.profile_kyc_data FOR UPDATE
USING (auth.uid() = user_id);

-- Only the user can delete their own KYC data
CREATE POLICY "Users can delete their own KYC data"
ON public.profile_kyc_data FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_profile_kyc_data_updated_at
  BEFORE UPDATE ON public.profile_kyc_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from profiles to profile_kyc_data
INSERT INTO public.profile_kyc_data (user_id, phone, street1, street2, city, state, postal_code, pan, dob)
SELECT user_id, phone, street1, street2, city, state, postal_code, pan, dob
FROM public.profiles
WHERE phone IS NOT NULL 
   OR street1 IS NOT NULL 
   OR pan IS NOT NULL 
   OR dob IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Remove sensitive columns from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS street1;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS street2;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS state;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS postal_code;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pan;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS dob;

-- Update the profiles_public view to remove any reference to these columns (if any)
-- The view should already only expose safe fields, but let's recreate it to be sure
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
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
FROM public.profiles;

-- Grant SELECT on the view
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;

-- Add comments
COMMENT ON TABLE public.profile_kyc_data IS 'Sensitive KYC data (phone, address, PAN, DOB) - separate from profiles for security. Only accessible by the user themselves.';
COMMENT ON TABLE public.profiles IS 'User profiles - public-safe fields only. Sensitive KYC data is in profile_kyc_data table.';