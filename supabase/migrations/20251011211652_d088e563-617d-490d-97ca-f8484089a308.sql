-- Update KYC status enum to include all statuses
ALTER TYPE kyc_status ADD VALUE IF NOT EXISTS 'NEEDS_INFO';
ALTER TYPE kyc_status ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE kyc_status ADD VALUE IF NOT EXISTS 'ACTIVATED';

-- Rename APPROVED to match Razorpay terminology
-- Note: Can't rename enum values, so we'll handle this in application logic
-- APPROVED will be treated as ACTIVATED in the application

-- Add new columns to razorpay_accounts table
ALTER TABLE public.razorpay_accounts 
ADD COLUMN IF NOT EXISTS onboarding_url text,
ADD COLUMN IF NOT EXISTS error_reason text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_razorpay_accounts_community_id 
ON public.razorpay_accounts(community_id);