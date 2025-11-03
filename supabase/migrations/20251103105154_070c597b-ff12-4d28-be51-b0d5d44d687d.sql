-- Create app_role enum for role management
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Only system can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (false);

-- Update reports table RLS to allow admins to view all reports
CREATE POLICY "Admins can view all reports"
ON public.reports
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to update report status
CREATE POLICY "Admins can update reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Create function to get reports with user details
CREATE OR REPLACE FUNCTION public.get_reports_admin(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  target_user_id uuid,
  target_name text,
  target_type text,
  reason text,
  message text,
  context_type text,
  context_id uuid,
  status text,
  created_at timestamp with time zone
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.reporter_id,
    rp.display_name AS reporter_name,
    r.target_user_id,
    tp.display_name AS target_name,
    r.target_type::text,
    r.reason,
    r.message,
    r.context_type::text,
    r.context_id,
    r.status::text,
    r.created_at
  FROM reports r
  LEFT JOIN profiles rp ON rp.user_id = r.reporter_id
  LEFT JOIN profiles tp ON tp.user_id = r.target_user_id
  WHERE (p_status IS NULL OR r.status::text = p_status)
    AND public.is_admin(auth.uid())
  ORDER BY r.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;