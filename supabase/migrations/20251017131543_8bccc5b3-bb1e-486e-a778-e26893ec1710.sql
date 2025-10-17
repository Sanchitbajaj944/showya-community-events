-- Add new columns to events table for enhanced event management
ALTER TABLE public.events
ADD COLUMN duration integer DEFAULT 60,
ADD COLUMN poster_url text,
ADD COLUMN performer_slots integer NOT NULL DEFAULT 1,
ADD COLUMN performer_ticket_price numeric NOT NULL DEFAULT 20,
ADD COLUMN audience_enabled boolean DEFAULT false,
ADD COLUMN audience_slots integer,
ADD COLUMN audience_ticket_price numeric,
ADD COLUMN meeting_url text;

-- Create promocodes table
CREATE TABLE public.promocodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  applies_to text NOT NULL CHECK (applies_to IN ('performer', 'audience', 'both')),
  usage_limit integer,
  usage_count integer DEFAULT 0,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(event_id, code)
);

-- Enable RLS on promocodes
ALTER TABLE public.promocodes ENABLE ROW LEVEL SECURITY;

-- Promocodes viewable by everyone
CREATE POLICY "Promocodes viewable by everyone"
ON public.promocodes FOR SELECT
USING (true);

-- Community owners can create promocodes for their events
CREATE POLICY "Event creators can create promocodes"
ON public.promocodes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = promocodes.event_id
    AND events.created_by = auth.uid()
  )
);

-- Event creators can update their promocodes
CREATE POLICY "Event creators can update promocodes"
ON public.promocodes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = promocodes.event_id
    AND events.created_by = auth.uid()
  )
);

-- Event creators can delete their promocodes
CREATE POLICY "Event creators can delete promocodes"
ON public.promocodes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = promocodes.event_id
    AND events.created_by = auth.uid()
  )
);