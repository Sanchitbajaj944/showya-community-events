-- Change default platform fee percentage from 5% to 10%
ALTER TABLE public.communities 
ALTER COLUMN platform_fee_percentage SET DEFAULT 10.0;