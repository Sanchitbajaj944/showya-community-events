-- Add incident location field to reports table
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS incident_location text;

-- Add comment to explain the field
COMMENT ON COLUMN public.reports.incident_location IS 'Specific location where incident occurred: chat, in_meeting, profile_picture, community_description, community_banner, event_page';

-- Update existing null messages with a default value
UPDATE public.reports 
SET message = 'No additional details provided' 
WHERE message IS NULL;

-- Now set NOT NULL constraint
ALTER TABLE public.reports 
ALTER COLUMN message SET NOT NULL;

COMMENT ON COLUMN public.reports.message IS 'Detailed description of the incident (minimum 50 characters required by client validation)';