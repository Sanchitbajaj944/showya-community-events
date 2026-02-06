
-- Add mic permission columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS allow_paid_audience_mic BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_free_audience_mic BOOLEAN NOT NULL DEFAULT false;

-- Add mic_permission column to event_participants table
ALTER TABLE public.event_participants 
ADD COLUMN IF NOT EXISTS mic_permission TEXT NOT NULL DEFAULT 'none';

-- Add check constraint for mic_permission values
ALTER TABLE public.event_participants 
ADD CONSTRAINT chk_mic_permission 
CHECK (mic_permission IN ('none', 'requested', 'granted', 'revoked'));

-- Enable realtime on event_participants for mic permission changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_participants;
