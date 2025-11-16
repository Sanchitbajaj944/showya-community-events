# Notification System Documentation

## Overview
The notification system provides comprehensive in-app and email notifications across all user interactions in Showya.

## Features
- ✅ In-app notifications with bell icon
- ✅ Email notifications via Resend
- ✅ Real-time notification updates
- ✅ Unread notification counter
- ✅ Mark as read functionality
- ✅ Mobile-responsive notification center
- ✅ Dedicated notifications page
- ✅ Automated triggers for all key events
- ✅ Context-aware notification routing

## Notification Matrix

### 📅 Event-Related Notifications
| Trigger | Audience | Delivery | Implementation |
|---------|----------|----------|----------------|
| New Event Created | Community followers | In-app (optional) | Manual via useNotifications |
| Event Registration | Performer, Community Owner | In-app + Email | `handle-event-registration` edge function |
| Event Edited | All attendees + followers | In-app + Email | `update-event` edge function |
| Meeting Link Changed | All attendees | In-app + Email | `update-event` edge function |
| Event Cancelled | All attendees | In-app + Email + Refund | Manual trigger required |
| Event Deleted | All attendees | In-app + Email + Refund | `delete-event` edge function |
| Slot Count Increased | Community followers | In-app | Database trigger |
| 1hr Reminder | All attendees | In-app + Email | Scheduled job (to be implemented) |

### 📹 Reels-Related Notifications
| Trigger | Audience | Delivery | Implementation |
|---------|----------|----------|----------------|
| Reel Uploaded | Community owner | In-app | Database trigger |
| Reel Liked | Community owner | In-app | Can be added via manual trigger |

### 🧾 Payment & Refund Notifications
| Trigger | Audience | Delivery | Implementation |
|---------|----------|----------|----------------|
| Booking Confirmed | Attendee | In-app + Email | `create-payment-order` edge function |
| Auto Refund | Affected users | In-app + Email | Razorpay webhook |
| Manual Refund | Attendee | Email | Admin action |

### 🛡 Report System Notifications
| Trigger | Audience | Delivery | Implementation |
|---------|----------|----------|----------------|
| Report Submitted | Admin + Host | In-app | Database trigger |
| Report Status Updated | Reporter | In-app | Database trigger |

### 🧑‍🤝‍🧑 Community & Messaging
| Trigger | Audience | Delivery | Implementation |
|---------|----------|----------|----------------|
| New Chat Message | Target users | In-app | Real-time via Supabase |
| New Member Joined | Community Owner | In-app | Database trigger |

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
