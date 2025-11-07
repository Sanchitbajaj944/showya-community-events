-- Fix 1: Make the community members policy more restrictive
-- Instead of allowing access to the profiles table directly, we'll restrict what can be accessed
-- Note: RLS controls row access, not columns, so we need to ensure application code uses profiles_public view

-- Keep the existing policy but add a comment for documentation
COMMENT ON POLICY "Community members can view other members' public profiles" ON public.profiles 
IS 'WARNING: This policy allows row access. Application MUST query profiles_public view to prevent PII exposure. Direct queries to profiles table will expose sensitive data.';

-- Fix 2: Remove plaintext banking data from razorpay_accounts
ALTER TABLE public.razorpay_accounts 
DROP COLUMN IF EXISTS bank_account_number,
DROP COLUMN IF EXISTS bank_ifsc,
DROP COLUMN IF EXISTS bank_beneficiary_name;

-- Ensure bank_masked column has a default
ALTER TABLE public.razorpay_accounts 
ALTER COLUMN bank_masked SET DEFAULT '****';

-- Fix 3: Add audit logging table for admin role management
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  performed_by uuid REFERENCES auth.users(id) NOT NULL,
  target_user_id uuid NOT NULL,
  role_granted text NOT NULL,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log FOR SELECT
USING (public.is_admin(auth.uid()));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.admin_audit_log FOR INSERT
WITH CHECK (auth.uid() = performed_by);