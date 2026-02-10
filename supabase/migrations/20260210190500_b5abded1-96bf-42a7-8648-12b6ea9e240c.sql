
-- Create table for storing custom email OTPs
CREATE TABLE public.email_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signin', -- 'signin' or 'signup'
  metadata JSONB DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0
);

-- Index for fast lookup
CREATE INDEX idx_email_otps_email_purpose ON public.email_otps (email, purpose, verified, expires_at);

-- Enable RLS
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- No direct client access - only edge functions (service role) should access this table
-- No RLS policies = no client access, which is what we want

-- Auto-cleanup old OTPs (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.email_otps WHERE expires_at < now() - INTERVAL '1 hour';
END;
$function$;
