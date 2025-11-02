import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateEventRequest {
  eventId: string;
  updates: {
    title?: string;
    description?: string;
    poster_url?: string;
    category?: string;
    event_date?: string;
    duration?: number;
    meeting_url?: string;
    location?: string;
    city?: string;
    performer_slots?: number;
    audience_enabled?: boolean;
    audience_slots?: number;
  };
  confirmDateChange?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { eventId, updates, confirmDateChange }: UpdateEventRequest = await req.json();

    // Get current event data
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    // Check if user is the event creator
    if (event.created_by !== user.id) {
      throw new Error("Only event creator can edit the event");
    }

    // Check if event has bookings
    const { data: bookings } = await supabase
      .from("event_participants")
      .select("user_id")
      .eq("event_id", eventId);

    const hasBookings = bookings && bookings.length > 0;

    // Calculate time until event
    const eventDate = new Date(event.event_date);
    const now = new Date();
    const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const minutesUntilEvent = hoursUntilEvent * 60;

    // Check if within restricted edit window (except meeting link)
    const editableMinutes = event.editable_before_event_minutes || 60;
    if (minutesUntilEvent <= editableMinutes) {
      const hasNonMeetingUpdates = Object.keys(updates).some(key => key !== 'meeting_url');
      if (hasNonMeetingUpdates) {
        return new Response(
          JSON.stringify({
            error: "restricted_window",
            message: `Event can only have meeting link updated within ${editableMinutes} minutes of start time`,
            allowedFields: ["meeting_url"]
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Check if price/payment fields are being changed when bookings exist
    if (hasBookings) {
      const restrictedFields = ["ticket_type", "performer_ticket_price", "audience_ticket_price"];
      const hasRestrictedChange = restrictedFields.some(field => {
        const key = field as keyof typeof updates;
        return updates.hasOwnProperty(key) && (updates as any)[key] !== (event as any)[field];
      });
      
      if (hasRestrictedChange) {
        return new Response(
          JSON.stringify({
            error: "locked_field",
            message: "Cannot change pricing after bookings have been made",
            lockedFields: restrictedFields
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Check for date/time change
    const isDateChanged = updates.event_date && updates.event_date !== event.event_date;
    if (isDateChanged && hasBookings && !confirmDateChange) {
      return new Response(
        JSON.stringify({
          error: "date_change_confirmation_required",
          message: "Date/time change requires confirmation as attendees will be notified",
          attendeeCount: bookings.length
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Warn if performer slots reduced below current bookings
    if (updates.performer_slots && hasBookings) {
      const performerCount = bookings.filter((b: any) => 
        b.role === 'performer'
      ).length;
      
      if (updates.performer_slots < performerCount) {
        return new Response(
          JSON.stringify({
            error: "slot_reduction_conflict",
            message: `Cannot reduce performer slots to ${updates.performer_slots} as ${performerCount} performers are already booked`,
            currentBookings: performerCount
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Create audit log entry
    await supabase.from("event_audit_log").insert({
      event_id: eventId,
      user_id: user.id,
      action: "update",
      old_values: event,
      new_values: updates
    });

    // Update the event
    const { data: updatedEvent, error: updateError } = await supabase
      .from("events")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", eventId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Send notifications to attendees for significant changes
    if (hasBookings && bookings.length > 0) {
      const notifications = [];
      
      // Meeting link updated
      if (updates.meeting_url) {
        for (const booking of bookings) {
          notifications.push({
            event_id: eventId,
            user_id: booking.user_id,
            notification_type: "meeting_link_updated",
            message: `The meeting link for "${event.title}" has been updated. Please check the event details.`
          });
        }
      }

      // Date/time changed
      if (isDateChanged) {
        for (const booking of bookings) {
          notifications.push({
            event_id: eventId,
            user_id: booking.user_id,
            notification_type: "date_time_changed",
            message: `The date/time for "${event.title}" has been changed. The new time is ${new Date(updates.event_date!).toLocaleString()}. You can cancel for a refund if this doesn't work for you.`
          });
        }
      }

      // Duration changed
      if (updates.duration && updates.duration !== event.duration) {
        for (const booking of bookings) {
          notifications.push({
            event_id: eventId,
            user_id: booking.user_id,
            notification_type: "duration_changed",
            message: `The duration for "${event.title}" has been changed to ${updates.duration} minutes.`
          });
        }
      }

      // Performer slots changed
      if (updates.performer_slots && updates.performer_slots !== event.performer_slots) {
        for (const booking of bookings) {
          notifications.push({
            event_id: eventId,
            user_id: booking.user_id,
            notification_type: "slots_changed",
            message: `The performer lineup for "${event.title}" has changed.`
          });
        }
      }

      // Insert notifications
      if (notifications.length > 0) {
        await supabase.from("event_notifications").insert(notifications);
      }
    }

    console.log(`Event ${eventId} updated successfully by user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        event: updatedEvent,
        notificationsSent: hasBookings ? bookings.length : 0
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error updating event:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});