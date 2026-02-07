
-- 1. Add profile fields for onboarding + WhatsApp consent
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS dob date,
ADD COLUMN IF NOT EXISTS whatsapp_number text,
ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz;

-- 2. Create message queue for multi-channel messaging
CREATE TABLE public.message_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  template_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  provider_message_id text,
  error text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS on message_queue
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- Only admins can view queue for debugging. Edge functions use service role (bypasses RLS).
CREATE POLICY "Admins can view message queue"
ON public.message_queue FOR SELECT
USING (public.is_admin(auth.uid()));

-- 4. Indexes for efficient queue processing
CREATE INDEX idx_message_queue_due 
ON public.message_queue (scheduled_at) 
WHERE status = 'queued';

CREATE INDEX idx_message_queue_user_event 
ON public.message_queue (user_id, event_id);

-- 5. Deduplication: prevent same message being queued twice
CREATE UNIQUE INDEX idx_message_queue_dedup
ON public.message_queue (user_id, event_id, template_name, channel)
WHERE status = 'queued';

-- 6. Updated_at trigger
CREATE TRIGGER update_message_queue_updated_at
BEFORE UPDATE ON public.message_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
