-- Add amount_paid column to track actual payment amount (after promo discounts)
ALTER TABLE public.event_participants 
ADD COLUMN amount_paid numeric DEFAULT 0;

-- Add a comment to explain the column
COMMENT ON COLUMN public.event_participants.amount_paid IS 'The actual amount paid by the user after any promo code discounts';