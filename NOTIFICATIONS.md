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
| Trigger | Audience | Delivery | Implementation | Status |
|---------|----------|----------|----------------|--------|
| New Event Created | Community followers | In-app (optional), Email (optional) | Manual via useNotifications | ⚠️ Optional |
| Event Registration | Performer, Community Owner | In-app + Email | `handle-event-registration` edge function | ✅ Implemented |
| Event Edited (time, title, price) | All attendees + followers | In-app + Email | `update-event` edge function | ✅ Implemented |
| Meeting Link Changed | All attendees | In-app + Email | `update-event` edge function (auto-detected) | ✅ Implemented |
| Event Cancelled | All attendees | In-app + Email + Refund Info | `cancel-event` edge function | ✅ Implemented |
| Event Deleted (with signups) | All attendees | In-app + Email + Refund Info | `delete-event` edge function | ✅ Implemented |
| Slot Count Increased | Community followers | In-app | Database trigger `notify_slot_increase` | ✅ Implemented |
| 1hr Reminder Before Event | All attendees | In-app + Email | Requires cron job/scheduler | ⏳ Pending |

### 📹 Reels-Related Notifications
| Trigger | Audience | Delivery | Implementation | Status |
|---------|----------|----------|----------------|--------|
| Reel Uploaded | All performers | In-app + Email | Database trigger `notify_reel_upload` | ✅ Implemented |
| Reel Liked | Community owner | In-app | Database trigger `notify_reel_like` | ✅ Implemented |

### 🧾 Payment & Refund Notifications
| Trigger | Audience | Delivery | Implementation | Status |
|---------|----------|----------|----------------|--------|
| Booking Confirmed | Attendee | In-app + Email | `create-payment-order` edge function | ✅ Implemented |
| Auto Refund Triggered | Affected users | In-app + Email | Triggered by cancellation/deletion | ✅ Implemented |
| Manual Refund by Host/Admin | Attendee | Email | Admin dashboard action | ⏳ Pending |

### 🛡 Report System Notifications
| Trigger | Audience | Delivery | Implementation | Status |
|---------|----------|----------|----------------|--------|
| Report Submitted | Admin + Community Host | In-app, Email (optional) | Database trigger `notify_report_submission` | ✅ Implemented |
| Report Status Updated | Reporter | In-app | Database trigger `notify_report_status_update` | ✅ Implemented |
| User Reported | Admin only | Dashboard only | No user-facing alert (prevent retaliation) | ✅ Implemented |

### 🧑‍🤝‍🧑 Community & Messaging
| Trigger | Audience | Delivery | Implementation | Status |
|---------|----------|----------|----------------|--------|
| New Chat Message | All community members | In-app + Email | Database trigger `notify_new_chat_message` | ✅ Implemented |
| New Member Joined Community | Community Owner | In-app | Database trigger `notify_community_owner_new_member` | ✅ Implemented |

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
