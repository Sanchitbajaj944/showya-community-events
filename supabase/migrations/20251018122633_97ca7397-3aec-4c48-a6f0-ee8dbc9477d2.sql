-- Add missing fields to razorpay_accounts table for proper Route tracking
ALTER TABLE public.razorpay_accounts
ADD COLUMN IF NOT EXISTS product_id TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'individual',
ADD COLUMN IF NOT EXISTS legal_business_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
ADD COLUMN IF NOT EXISTS bank_beneficiary_name TEXT,
ADD COLUMN IF NOT EXISTS tnc_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tnc_accepted_at TIMESTAMP WITH TIME ZONE;

-- Create index on product_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_razorpay_accounts_product_id 
ON public.razorpay_accounts(product_id);

-- Add comment explaining the new fields
COMMENT ON COLUMN public.razorpay_accounts.product_id IS 'Razorpay product configuration ID (acc_prd_xxx) for Route';
COMMENT ON COLUMN public.razorpay_accounts.business_type IS 'Business type: individual, proprietorship, partnership, private_limited, etc.';
COMMENT ON COLUMN public.razorpay_accounts.legal_business_name IS 'Legal business name as registered';
COMMENT ON COLUMN public.razorpay_accounts.bank_account_number IS 'Settlement bank account number (encrypted in production)';
COMMENT ON COLUMN public.razorpay_accounts.bank_ifsc IS 'Bank IFSC code for settlements';
COMMENT ON COLUMN public.razorpay_accounts.bank_beneficiary_name IS 'Bank account holder name';
COMMENT ON COLUMN public.razorpay_accounts.tnc_accepted IS 'Whether user accepted Razorpay terms and conditions';
COMMENT ON COLUMN public.razorpay_accounts.tnc_accepted_at IS 'Timestamp when T&C was accepted';