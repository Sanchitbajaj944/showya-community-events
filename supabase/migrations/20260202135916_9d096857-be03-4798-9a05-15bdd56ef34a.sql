-- Create a table to store site configuration including homepage section order
CREATE TABLE public.site_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read site config
CREATE POLICY "Site config is viewable by everyone" 
ON public.site_config 
FOR SELECT 
USING (true);

-- Only admins can update site config
CREATE POLICY "Admins can update site config" 
ON public.site_config 
FOR UPDATE 
USING (is_admin(auth.uid()));

-- Only admins can insert site config
CREATE POLICY "Admins can insert site config" 
ON public.site_config 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

-- Insert default homepage section order
INSERT INTO public.site_config (key, value)
VALUES ('homepage_section_order', '["showclips", "events", "communities"]'::jsonb);