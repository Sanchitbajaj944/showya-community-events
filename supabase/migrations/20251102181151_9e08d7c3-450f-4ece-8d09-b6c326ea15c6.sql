-- Create event audit log table
CREATE TABLE public.event_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event notifications table
CREATE TABLE public.event_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new fields to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS editable_before_event_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS meeting_link_last_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.event_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit log
CREATE POLICY "Event creators can view audit log"
ON public.event_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_audit_log.event_id
    AND events.created_by = auth.uid()
  )
);

CREATE POLICY "System can insert audit log"
ON public.event_audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.event_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.event_notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.event_notifications FOR INSERT
WITH CHECK (true);

-- Function to check if event has bookings
CREATE OR REPLACE FUNCTION public.event_has_bookings(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = _event_id
  )
$$;

-- Function to get booking count
CREATE OR REPLACE FUNCTION public.get_event_booking_count(_event_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.event_participants
  WHERE event_id = _event_id
$$;

-- Trigger to update meeting_link_last_updated_at
CREATE OR REPLACE FUNCTION public.update_meeting_link_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.meeting_url IS DISTINCT FROM OLD.meeting_url THEN
    NEW.meeting_link_last_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_meeting_link_timestamp
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_meeting_link_timestamp();