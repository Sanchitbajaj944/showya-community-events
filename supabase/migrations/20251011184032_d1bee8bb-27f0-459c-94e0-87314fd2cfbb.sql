-- Create enum for KYC status
CREATE TYPE public.kyc_status AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'VERIFIED',
  'ACTIVATED',
  'NEEDS_INFO',
  'REJECTED'
);

-- Create communities table
CREATE TABLE public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  kyc_status kyc_status NOT NULL DEFAULT 'NOT_STARTED',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create razorpay_accounts table
CREATE TABLE public.razorpay_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL UNIQUE REFERENCES public.communities(id) ON DELETE CASCADE,
  razorpay_account_id TEXT NOT NULL UNIQUE,
  kyc_status kyc_status NOT NULL DEFAULT 'IN_PROGRESS',
  bank_masked TEXT,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add community_id to events table if not exists
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'free' CHECK (ticket_type IN ('free', 'paid'));

-- Enable RLS
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.razorpay_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for communities
CREATE POLICY "Communities are viewable by everyone"
ON public.communities
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own community (max 1)"
ON public.communities
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own community"
ON public.communities
FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their own community"
ON public.communities
FOR DELETE
USING (auth.uid() = owner_id);

-- RLS Policies for razorpay_accounts
CREATE POLICY "Only community owners can view their razorpay account"
ON public.razorpay_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE communities.id = razorpay_accounts.community_id
    AND communities.owner_id = auth.uid()
  )
);

CREATE POLICY "Only system can insert razorpay accounts"
ON public.razorpay_accounts
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only system can update razorpay accounts"
ON public.razorpay_accounts
FOR UPDATE
USING (false);

-- Trigger to update communities.kyc_status when razorpay_accounts.kyc_status changes
CREATE OR REPLACE FUNCTION sync_community_kyc_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.communities
  SET kyc_status = NEW.kyc_status,
      updated_at = now()
  WHERE id = NEW.community_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_kyc_status_trigger
AFTER INSERT OR UPDATE OF kyc_status ON public.razorpay_accounts
FOR EACH ROW
EXECUTE FUNCTION sync_community_kyc_status();

-- Trigger for updated_at on communities
CREATE TRIGGER update_communities_updated_at
BEFORE UPDATE ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();