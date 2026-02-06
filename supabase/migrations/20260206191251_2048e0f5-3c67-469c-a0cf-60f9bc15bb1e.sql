-- Add meeting status tracking columns to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS meeting_status TEXT NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS meeting_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meeting_ended_at TIMESTAMPTZ;

-- Add check constraint via trigger for valid statuses
CREATE OR REPLACE FUNCTION public.validate_meeting_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.meeting_status NOT IN ('scheduled', 'live', 'ended') THEN
    RAISE EXCEPTION 'Invalid meeting_status: %. Must be scheduled, live, or ended.', NEW.meeting_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_meeting_status_trigger
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meeting_status();

-- Index for efficient queries on live events
CREATE INDEX IF NOT EXISTS idx_events_meeting_status ON public.events (meeting_status) WHERE meeting_status = 'live';
