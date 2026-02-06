

# Phase 1: Join Page, Audience Cap, and Mic Permission System

This is the first phase of a larger event restructuring. It covers: the `/events/:eventId/join` page, configurable audience capacity (default 50), mic permission tracking, and updated JaaS token logic based on role and payment status.

---

## What Changes for Users

**For event hosts:**
- During event creation, audience slots now default to 50 (configurable)
- New mic control capabilities inside the meeting (approve/revoke mic requests)
- A new field `allow_paid_audience_mic` toggleable during event creation (defaults to on)

**For audience members:**
- A dedicated Join page at `/events/:eventId/join` handles the full flow: auth check, role detection, slot availability check, payment (if needed), and meeting entry
- Free audience always joins in listen-only mode (mic permanently disabled)
- Paid audience can request mic access from the host
- Clear "Audience Full" messaging when cap is reached

**For performers:**
- No major change -- performers join with mic/video access as before

---

## Technical Details

### 1. Database Migration

**events table -- add columns:**
- `allow_paid_audience_mic` BOOLEAN DEFAULT true
- `allow_free_audience_mic` BOOLEAN DEFAULT false

The `audience_slots` column already exists and is nullable. We update the default to 50 in the event creation form.

**event_participants table -- add column:**
- `mic_permission` TEXT DEFAULT 'none' (values: none, requested, granted, revoked)

**Enable realtime on event_participants** so mic permission changes are pushed to the JaaS meeting UI in real-time.

```text
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_participants;
```

### 2. New Edge Function: `get-join-context`

Called when user lands on `/events/:eventId/join`. Returns:
- Event details (title, ticket_type, prices, audience cap)
- Audience slots remaining (computed via count query)
- Performer slots remaining
- User's existing booking (if any), including role and payment status
- Whether the user is the host
- Mic rules (allow_paid_audience_mic, allow_free_audience_mic)

This is a single backend call that gives the join page everything it needs to render.

### 3. Updated Edge Function: `generate-jaas-token`

Enhanced to set JaaS meeting config based on role and payment:

| Role | Payment | Moderator? | Start Muted? | Can Unmute? |
|------|---------|-----------|-------------|------------|
| Host | -- | Yes | No | Yes |
| Performer | -- | Yes | No | Yes |
| Audience (paid) | paid | No | Yes | Yes (after host approval) |
| Audience (free) | free/none | No | Yes | No |

The token response will include a `micPolicy` field: `"open"`, `"request-only"`, or `"listen-only"` so the frontend knows how to configure the meeting UI.

### 4. New Edge Functions: `request-mic` and `resolve-mic`

**`request-mic(event_id)`:**
- Validates user is a paid audience member
- Updates `mic_permission` from `none` to `requested`
- Sends real-time notification to host

**`resolve-mic(event_id, target_user_id, action)`:**
- Only callable by host (event creator)
- Sets `mic_permission` to `granted` or `revoked`
- Action: `grant` or `revoke`

### 5. New Page: `/events/:eventId/join`

A dedicated join flow page with this logic:

```text
1. Auth gate --> if not signed in, redirect to sign-in with return URL
2. Call get-join-context
3. Determine user state:
   a. Already booked --> "Join Meeting" button
   b. Host --> "Join as Host" button
   c. No booking:
      - Check audience remaining
      - If sold out --> show "Audience Full" 
      - If free audience --> auto-create booking, show "Join (Listen-only)"
      - If paid audience --> show "Buy Ticket & Join" with price
      - If performer slots available --> show performer option too
4. On booking/payment success --> show "Join Meeting" button
5. Clicking "Join Meeting" renders JaasMeeting component
```

### 6. Updated JaasMeeting Component

- Accept a `micPolicy` prop from the token response
- For `listen-only`: disable mic button, show "Listen-only event" tooltip
- For `request-only`: show "Request Mic" button that calls `request-mic`
- Listen to realtime changes on `event_participants` for mic_permission updates
- When mic_permission changes to `granted`, enable the mic button
- Host sees a panel of pending mic requests with approve/revoke buttons

### 7. Updated Event Creation (`CreateEvent.tsx`)

- Default `audience_slots` to 50 when audience is enabled
- Add `allow_paid_audience_mic` toggle (default on) in the ticketing step
- `allow_free_audience_mic` is always false (hard rule, not shown in UI)

### 8. Booking Flow Updates (`BookingModal.tsx`)

- When role is `audience` and event is free, the flow auto-books silently
- Availability check uses count from `get_event_participant_counts` RPC
- After payment success, re-validate that slots are still available before confirming. If sold out, show error and initiate refund

### 9. Route Addition

Add to `App.tsx`:
```text
/events/:eventId/join --> new JoinEvent page (protected route)
```

### 10. Config Updates

Add to `supabase/config.toml`:
```text
[functions.get-join-context]
verify_jwt = false

[functions.request-mic]
verify_jwt = false

[functions.resolve-mic]
verify_jwt = false
```

(Auth validated in code, not via JWT verification.)

---

## Files to Create
- `src/pages/JoinEvent.tsx` -- the new join flow page
- `supabase/functions/get-join-context/index.ts`
- `supabase/functions/request-mic/index.ts`
- `supabase/functions/resolve-mic/index.ts`

## Files to Modify
- `src/App.tsx` -- add `/events/:eventId/join` route
- `src/pages/CreateEvent.tsx` -- default audience_slots to 50, add mic toggle
- `src/components/JaasMeeting.tsx` -- mic policy handling, request mic UI, host controls
- `src/components/BookingModal.tsx` -- post-payment slot validation
- `supabase/functions/generate-jaas-token/index.ts` -- role-based mic config in token response
- `supabase/config.toml` -- new function entries (auto-managed)
- Database migration for new columns and realtime

---

## What is NOT in Phase 1
- Full reservation system with temporary holds (using simple check approach instead)
- Event editing restrictions for new fields
- Advanced host dashboard for mic management (will use in-meeting controls)

