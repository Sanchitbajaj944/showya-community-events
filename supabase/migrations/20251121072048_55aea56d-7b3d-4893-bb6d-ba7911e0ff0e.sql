-- Drop existing triggers if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS on_new_chat_message ON community_messages;
DROP TRIGGER IF EXISTS on_new_community_member ON community_members;
DROP TRIGGER IF EXISTS on_event_slot_increase ON events;
DROP TRIGGER IF EXISTS on_new_reel_upload ON spotlights;
DROP TRIGGER IF EXISTS on_reel_like ON spotlight_likes;
DROP TRIGGER IF EXISTS on_report_submission ON reports;
DROP TRIGGER IF EXISTS on_report_status_update ON reports;
DROP TRIGGER IF EXISTS on_event_participant_join ON event_participants;
DROP TRIGGER IF EXISTS on_community_creation ON communities;
DROP TRIGGER IF EXISTS on_kyc_status_update ON razorpay_accounts;
DROP TRIGGER IF EXISTS on_spotlight_like_change ON spotlight_likes;
DROP TRIGGER IF EXISTS on_meeting_url_update ON events;
DROP TRIGGER IF EXISTS check_message_rate_limit_trigger ON community_messages;
DROP TRIGGER IF EXISTS update_communities_updated_at ON communities;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_community_messages_updated_at ON community_messages;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Now create all triggers
CREATE TRIGGER on_new_chat_message
  AFTER INSERT ON community_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_community_members_on_message();

CREATE TRIGGER on_new_community_member
  AFTER INSERT ON community_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_community_owner_new_member();

CREATE TRIGGER on_event_slot_increase
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_slot_increase();

CREATE TRIGGER on_new_reel_upload
  AFTER INSERT ON spotlights
  FOR EACH ROW
  EXECUTE FUNCTION notify_reel_upload();

CREATE TRIGGER on_reel_like
  AFTER INSERT ON spotlight_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_reel_like();

CREATE TRIGGER on_report_submission
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_report_submission();

CREATE TRIGGER on_report_status_update
  AFTER UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_report_status_update();

CREATE TRIGGER on_event_participant_join
  AFTER INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION add_event_participant_to_community();

CREATE TRIGGER on_community_creation
  AFTER INSERT ON communities
  FOR EACH ROW
  EXECUTE FUNCTION add_owner_as_member();

CREATE TRIGGER on_kyc_status_update
  AFTER UPDATE ON razorpay_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_community_kyc_status();

CREATE TRIGGER on_spotlight_like_change
  AFTER INSERT OR DELETE ON spotlight_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_spotlight_like_count();

CREATE TRIGGER on_meeting_url_update
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_link_timestamp();

CREATE TRIGGER check_message_rate_limit_trigger
  BEFORE INSERT ON community_messages
  FOR EACH ROW
  EXECUTE FUNCTION check_message_rate_limit();

CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_messages_updated_at
  BEFORE UPDATE ON community_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();