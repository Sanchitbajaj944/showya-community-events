-- Fix search path for sync_community_kyc_status function
CREATE OR REPLACE FUNCTION sync_community_kyc_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.communities
  SET kyc_status = NEW.kyc_status,
      updated_at = now()
  WHERE id = NEW.community_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;