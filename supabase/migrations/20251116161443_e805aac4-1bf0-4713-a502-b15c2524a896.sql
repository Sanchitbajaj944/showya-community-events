-- Add platform_fee_percentage column to communities table
ALTER TABLE public.communities 
ADD COLUMN platform_fee_percentage numeric DEFAULT 5.0 NOT NULL CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 100);

COMMENT ON COLUMN public.communities.platform_fee_percentage IS 'Platform commission percentage taken from ticket sales (0-100)';

-- Update existing communities to have default 5% fee
UPDATE public.communities SET platform_fee_percentage = 5.0 WHERE platform_fee_percentage IS NULL;