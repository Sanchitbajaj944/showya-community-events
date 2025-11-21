-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Set replica identity to full for better realtime support
ALTER TABLE notifications REPLICA IDENTITY FULL;