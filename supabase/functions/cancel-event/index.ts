import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancelEventRequest {
  event_id: string;
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { event_id, reason }: CancelEventRequest = await req.json();

    // Get event details and verify ownership
    const { data: event, error: eventError } = await supabaseClient
      .from("events")
      .select("*")
      .eq("id", event_id)
      .eq("created_by", user.id)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found or you don't have permission");
    }

    // Check if already cancelled
    if (event.is_cancelled) {
      throw new Error("Event is already cancelled");
    }

    // Get all attendees
    const { data: attendees } = await supabaseClient
      .from("event_participants")
      .select("user_id, role")
      .eq("event_id", event_id);

    // Mark event as cancelled
    const { error: updateError } = await supabaseClient
      .from("events")
      .update({ is_cancelled: true })
      .eq("id", event_id);

    if (updateError) throw updateError;

    // Send notifications to all attendees
    if (attendees && attendees.length > 0) {
      const notifications = attendees.map(attendee => ({
        user_id: attendee.user_id,
        title: "Event Cancelled",
        message: `The event "${event.title}" has been cancelled. ${event.ticket_type === 'paid' ? 'You will receive an automatic refund within 5-7 business days.' : ''} ${reason ? `Reason: ${reason}` : ''}`,
        type: "warning",
        category: "event",
        related_id: event_id,
        action_url: `/events/${event_id}`,
      }));

      await supabaseClient.from("notifications").insert(notifications);

      // Send email notifications
      const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "").replace("https://", "https://") || "https://showya.app";
      
      for (const attendee of attendees) {
        try {
          await supabaseClient.functions.invoke("send-notification-email", {
            body: {
              user_id: attendee.user_id,
              title: "Event Cancelled - Refund Information",
              message: `The event "${event.title}" has been cancelled. ${event.ticket_type === 'paid' ? 'You will receive an automatic refund within 5-7 business days. Check your payment method for the refund.' : ''} ${reason ? `Reason: ${reason}` : ''}`,
              action_url: `${baseUrl}/events/${event_id}`,
            },
          });
        } catch (emailError) {
          console.error("Error sending cancellation email:", emailError);
        }
      }

      console.log(`Sent cancellation notifications to ${attendees.length} attendees`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Event cancelled successfully",
        attendees_notified: attendees?.length || 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error cancelling event:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

serve(handler);
