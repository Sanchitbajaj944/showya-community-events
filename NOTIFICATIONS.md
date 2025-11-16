# Notification System Documentation

## Overview
The notification system provides in-app notifications, email notifications, and real-time updates across the application.

## Features
- ✅ In-app notifications with bell icon
- ✅ Email notifications via Resend
- ✅ Real-time notification updates
- ✅ Unread notification counter
- ✅ Mark as read functionality
- ✅ Mobile-responsive notification center
- ✅ Dedicated notifications page

## Database Tables

### notifications
- `id`: UUID (primary key)
- `user_id`: UUID (recipient)
- `title`: TEXT (notification title)
- `message`: TEXT (notification content)
- `type`: TEXT ('info', 'success', 'warning', 'error')
- `category`: TEXT ('event', 'booking', 'community', 'system', 'general')
- `related_id`: UUID (optional - ID of related entity)
- `action_url`: TEXT (optional - URL to navigate when clicked)
- `is_read`: BOOLEAN
- `is_email_sent`: BOOLEAN
- `created_at`: TIMESTAMP
- `read_at`: TIMESTAMP (optional)

## Usage

### From React Components

Use the `useNotifications` hook:

```typescript
import { useNotifications } from "@/hooks/useNotifications";

function MyComponent() {
  const { createNotification, createBulkNotifications } = useNotifications();

  // Send a single notification
  const sendNotification = async () => {
    await createNotification({
      user_id: "user-uuid",
      title: "Event Reminder",
      message: "Your event starts in 1 hour!",
      type: "info",
      category: "event",
      related_id: "event-uuid",
      action_url: "/events/event-uuid",
      send_email: true, // Send email notification
    });
  };

  // Send to multiple users
  const sendBulkNotifications = async (userIds: string[]) => {
    await createBulkNotifications(userIds, {
      title: "Community Update",
      message: "New event has been created!",
      type: "success",
      category: "community",
      send_email: true,
    });
  };
}
```

### From Edge Functions

```typescript
// Insert notification directly
await supabase
  .from('notifications')
  .insert({
    user_id: userId,
    title: 'Booking Confirmed',
    message: 'Your booking has been confirmed!',
    type: 'success',
    category: 'booking',
    related_id: eventId,
    action_url: `/events/${eventId}`,
  });

// Send email
await supabase.functions.invoke('send-notification-email', {
  body: {
    user_id: userId,
    title: 'Booking Confirmed',
    message: 'Your booking for the event has been confirmed!',
    action_url: `https://yourapp.com/events/${eventId}`,
  },
});
```

## UI Components

### NotificationCenter (Desktop)
Displays in the Header as a bell icon with unread count badge.

### BottomNav (Mobile)
Includes a notification bell in the bottom navigation with unread counter.

### Notifications Page
Full-page view at `/notifications` showing all notifications with filtering options.

## Real-time Updates
Notifications automatically update in real-time when new notifications arrive using Supabase Realtime.

## Email Configuration

**Important**: Update the email sender in `supabase/functions/send-notification-email/index.ts`:
```typescript
from: "Your App Name <notifications@yourdomain.com>"
```

Replace `onboarding@resend.dev` with your verified domain in Resend.

## Security
- Users can only view their own notifications (RLS policies)
- Users can only mark their own notifications as read
- System can create notifications for any user
- Email sending uses service role key (secure)

## Best Practices
1. Always include meaningful titles and messages
2. Use appropriate notification types (info, success, warning, error)
3. Include action URLs when users need to take action
4. Set `send_email: true` for important notifications only
5. Use categories to help users filter notifications
