-- Add JaaS room name column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS jaas_room_name text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_events_jaas_room_name ON public.events(jaas_room_name);

-- Add comment for documentation
COMMENT ON COLUMN public.events.jaas_room_name IS 'Unique JaaS room identifier for embedded video conferencing';