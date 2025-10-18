-- Add PAN and DOB fields to profiles table for KYC
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pan text,
ADD COLUMN IF NOT EXISTS dob date;

-- Add stakeholder and products tracking to razorpay_accounts
ALTER TABLE public.razorpay_accounts
ADD COLUMN IF NOT EXISTS stakeholder_id text,
ADD COLUMN IF NOT EXISTS products_requested boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS products_activated boolean DEFAULT false;

-- Create kyc_documents table to track document uploads
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  razorpay_account_id text NOT NULL,
  stakeholder_id text NOT NULL,
  document_type text NOT NULL,
  document_name text NOT NULL,
  upload_status text NOT NULL DEFAULT 'pending',
  uploaded_at timestamp with time zone DEFAULT now(),
  error_message text,
  UNIQUE(community_id, document_type)
);

-- Enable RLS on kyc_documents
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Only community owners can view their KYC documents
CREATE POLICY "Community owners can view their kyc documents"
ON public.kyc_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE communities.id = kyc_documents.community_id
    AND communities.owner_id = auth.uid()
  )
);

-- Policy: System can insert kyc documents
CREATE POLICY "System can insert kyc documents"
ON public.kyc_documents
FOR INSERT
WITH CHECK (false);

-- Policy: System can update kyc documents
CREATE POLICY "System can update kyc documents"
ON public.kyc_documents
FOR UPDATE
USING (false);