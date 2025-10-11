-- Add address fields to profiles table for KYC
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS street1 TEXT,
ADD COLUMN IF NOT EXISTS street2 TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT;