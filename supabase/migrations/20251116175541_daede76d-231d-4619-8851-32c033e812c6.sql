-- Trigger for new community member notifications
CREATE OR REPLACE FUNCTION notify_community_owner_new_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, category, related_id, action_url)
  SELECT 
    c.owner_id,
    'New Community Member',
    p.name || ' joined your community "' || c.name || '"',
    'info',
    'community',
    NEW.community_id,
    '/communities/' || NEW.community_id
  FROM communities c
  LEFT JOIN profiles p ON p.user_id = NEW.user_id
  WHERE c.id = NEW.community_id AND NEW.role != 'owner';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_community_member_joined
AFTER INSERT ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION notify_community_owner_new_member();

-- Trigger for event slot increase notifications
CREATE OR REPLACE FUNCTION notify_slot_increase()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.performer_slots > OLD.performer_slots THEN
    INSERT INTO public.notifications (user_id, title, message, type, category, related_id, action_url)
    SELECT 
      cm.user_id,
      'More Slots Available',
      'Additional performer slots are now available for "' || NEW.title || '"',
      'info',
      'event',
      NEW.id,
      '/events/' || NEW.id
    FROM community_members cm
    WHERE cm.community_id = NEW.community_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_event_slots_increased
AFTER UPDATE ON public.events
FOR EACH ROW
WHEN (OLD.performer_slots IS DISTINCT FROM NEW.performer_slots)
EXECUTE FUNCTION notify_slot_increase();

-- Trigger for new reel upload notifications
CREATE OR REPLACE FUNCTION notify_reel_upload()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, category, related_id, action_url)
  SELECT 
    c.owner_id,
    'New Reel Uploaded',
    'A new reel has been uploaded for event in "' || NEW.community_name || '"',
    'info',
    'community',
    NEW.id,
    '/reels'
  FROM communities c
  WHERE c.name = NEW.community_name AND c.owner_id != NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_reel_uploaded
AFTER INSERT ON public.spotlights
FOR EACH ROW
EXECUTE FUNCTION notify_reel_upload();

-- Trigger for report submissions
CREATE OR REPLACE FUNCTION notify_report_submission()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, category, related_id)
  SELECT 
    ur.user_id,
    'New Report Submitted',
    'A new ' || NEW.target_type || ' report has been submitted',
    'warning',
    'system',
    NEW.id
  FROM user_roles ur
  WHERE ur.role = 'admin';
  
  IF NEW.context_type = 'community' THEN
    INSERT INTO public.notifications (user_id, title, message, type, category, related_id)
    SELECT 
      c.owner_id,
      'Report Received',
      'A report has been filed regarding your community',
      'warning',
      'community',
      NEW.id
    FROM communities c
    WHERE c.id = NEW.context_id::uuid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_report_submitted
AFTER INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION notify_report_submission();

-- Trigger for report status updates
CREATE OR REPLACE FUNCTION notify_report_status_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, category, related_id)
    VALUES (
      NEW.reporter_id,
      'Report Status Updated',
      'Your report has been ' || NEW.status,
      'info',
      'system',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_report_status_changed
AFTER UPDATE ON public.reports
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_report_status_update();