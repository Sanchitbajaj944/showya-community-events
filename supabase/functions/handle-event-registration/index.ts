import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RegistrationRequest {
  event_id: string;
  user_id: string;
  role: "performer" | "audience";
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

    const { event_id, user_id, role }: RegistrationRequest = await req.json();

    // Get event details
    const { data: event, error: eventError } = await supabaseClient
      .from("events")
      .select("*, community_id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    // Get community owner
    const { data: community } = await supabaseClient
      .from("communities")
      .select("owner_id")
      .eq("id", event.community_id)
      .single();

    // Get user profile
    const { data: userProfile } = await supabaseClient
      .from("profiles")
      .select("name, email")
      .eq("user_id", user_id)
      .single();

    // Send notification to performer with event details
    if (role === "performer") {
      await supabaseClient.from("notifications").insert({
        user_id: user_id,
        title: "Event Registration Confirmed",
        message: `You're registered as a performer for "${event.title}". Event starts at ${new Date(event.event_date).toLocaleString()}.`,
        type: "success",
        category: "event",
        related_id: event_id,
        action_url: `/events/${event_id}`,
      });

      // Send email with meeting link and details
      await supabaseClient.functions.invoke("send-notification-email", {
        body: {
          user_id: user_id,
          title: "Performance Details - Action Required",
          message: `You're confirmed as a performer for "${event.title}". Meeting link: ${event.meeting_url || "Will be shared soon"}. Please review prerequisites and prepare for your performance.`,
          action_url: `${Deno.env.get("SUPABASE_URL")}/events/${event_id}`,
        },
      });
    }

    // Notify community owner about new registration
    if (community?.owner_id) {
      await supabaseClient.from("notifications").insert({
        user_id: community.owner_id,
        title: "New Event Registration",
        message: `${userProfile?.name || "Someone"} registered as ${role} for "${event.title}"`,
        type: "info",
        category: "event",
        related_id: event_id,
        action_url: `/events/${event_id}/dashboard`,
      });

      // Send email to community owner
      await supabaseClient.functions.invoke("send-notification-email", {
        body: {
          user_id: community.owner_id,
          title: "New Event Registration",
          message: `${userProfile?.name || "Someone"} has registered for your event "${event.title}" as a ${role}.`,
          action_url: `${Deno.env.get("SUPABASE_URL")}/events/${event_id}/dashboard`,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error handling registration:", error);
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
