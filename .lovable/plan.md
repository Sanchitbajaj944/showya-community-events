

# Event-Related WhatsApp Notifications

Now that WhatsApp is working, we need to wire it into all event flows. Here's what needs to happen:

## What Already Works
- In-app notifications + Email for: registration, event update, cancellation, deletion
- WhatsApp `send-whatsapp` edge function is tested and working
- `profiles` table has `phone` and `whatsapp_opt_in` fields
- `message_queue` table exists for tracking delivery

## What We'll Build

### 1. Helper: WhatsApp dispatch logic in edge functions
A reusable helper pattern added to each edge function that:
- Looks up the user's `phone` and `whatsapp_opt_in` from `profiles`
- Only sends WhatsApp if opted in and phone exists
- Queues the message in `message_queue` for tracking
- Calls `send-whatsapp` with the appropriate template

### 2. Wire WhatsApp into `handle-event-registration`
- **Performer registration**: Send `performer_confirmed` template with event name, date, and meeting link
- **Audience registration**: No WhatsApp (low priority, email + in-app sufficient)

### 3. Wire WhatsApp into `update-event`
- When date/time or meeting link changes and attendees exist, send `event_updated` template to all opted-in attendees with the updated details

### 4. Wire WhatsApp into `cancel-event`
- Send `event_cancelled` template to all opted-in attendees with event name and refund info

### 5. Wire WhatsApp into `delete-event`
- Same as cancellation -- send `event_cancelled` template to all opted-in participants

### 6. Event Reminders (T-24h and T-1h)
- Create a new `process-event-reminders` edge function that:
  - Queries events starting in the next 24h or 1h window
  - Checks if reminders were already sent (via `message_queue`)
  - Sends `event_reminder_24h` or `event_reminder_1h` WhatsApp templates to opted-in attendees
  - Also sends in-app notifications + email for T-1h
- Set up a **pg_cron** job that runs every 15 minutes calling this function

## Technical Details

### Edge function changes (5 files)

| File | Change |
|------|--------|
| `handle-event-registration/index.ts` | Add WhatsApp dispatch for performer role |
| `update-event/index.ts` | Add WhatsApp dispatch for date/meeting link changes |
| `cancel-event/index.ts` | Add WhatsApp dispatch to all attendees |
| `delete-event/index.ts` | Add WhatsApp dispatch to all participants |
| **NEW** `process-event-reminders/index.ts` | Cron-triggered reminder function |

### WhatsApp dispatch pattern (added to each function)
```text
1. Query profiles for user's phone + whatsapp_opt_in
2. If opted in + phone exists:
   a. Insert into message_queue (status: 'queued')
   b. Call send-whatsapp with template + parameters
   c. message_queue status updated by send-whatsapp automatically
```

### Cron job setup
A SQL statement to schedule `process-event-reminders` every 15 minutes using `pg_cron` + `pg_net`.

### Config updates
- Add `process-event-reminders` to `supabase/config.toml` with `verify_jwt = false`

### Meta Template Requirement
The following WhatsApp templates must be pre-approved in your Meta Business dashboard:
- `performer_confirmed` -- parameters: event name, date
- `event_updated` -- parameters: event name, change details
- `event_cancelled` -- parameters: event name
- `event_reminder_24h` -- parameters: event name, date/time
- `event_reminder_1h` -- parameters: event name, meeting link

Until these templates are approved, you can test with `hello_world`. The code will gracefully handle template send failures without breaking the main flow.

