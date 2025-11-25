-- Create refunds table to track all refund requests
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  razorpay_payment_id TEXT NOT NULL,
  razorpay_refund_id TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  refund_percentage INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  error_message TEXT,
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Users can view their own refunds
CREATE POLICY "Users can view their own refunds"
ON public.refunds
FOR SELECT
USING (auth.uid() = user_id);

-- Community owners can view refunds for their events
CREATE POLICY "Event creators can view event refunds"
ON public.refunds
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = refunds.event_id
    AND events.created_by = auth.uid()
  )
);

-- System can insert refunds
CREATE POLICY "System can insert refunds"
ON public.refunds
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- System can update refunds
CREATE POLICY "System can update refund status"
ON public.refunds
FOR UPDATE
USING (true);

-- Create index for faster queries
CREATE INDEX idx_refunds_user_id ON public.refunds(user_id);
CREATE INDEX idx_refunds_event_id ON public.refunds(event_id);
CREATE INDEX idx_refunds_payment_id ON public.refunds(razorpay_payment_id);
CREATE INDEX idx_refunds_status ON public.refunds(status);

-- Create trigger to update updated_at
CREATE TRIGGER update_refunds_updated_at
BEFORE UPDATE ON public.refunds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add payment_id column to event_participants to track Razorpay payments
ALTER TABLE public.event_participants
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Create index for payment tracking
CREATE INDEX IF NOT EXISTS idx_participants_payment_id ON public.event_participants(razorpay_payment_id);

COMMENT ON TABLE public.refunds IS 'Tracks all refund requests and their status with Razorpay';
COMMENT ON COLUMN public.refunds.status IS 'Refund status: pending, processing, completed, failed';
COMMENT ON COLUMN public.refunds.refund_percentage IS 'Percentage of refund: 0, 75, or 100';
COMMENT ON COLUMN public.event_participants.payment_status IS 'Payment status: pending, captured, failed';