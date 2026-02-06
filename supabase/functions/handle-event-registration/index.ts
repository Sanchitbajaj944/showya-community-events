import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const RegistrationSchema = z.object({
  event_id: z.string().uuid("Invalid event ID format"),
  user_id: z.string().uuid("Invalid user ID format"),
  role: z.enum(["performer", "audience"], {
    errorMap: () => ({ message: "Role must be 'performer' or 'audience'" }),
  }),
});

type RegistrationRequest = z.infer<typeof RegistrationSchema>;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Parse and validate input
    const requestBody = await req.json();
    const validationResult = RegistrationSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors.map(e => e.message) 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const { event_id, user_id, role }: RegistrationRequest = validationResult.data;

    // Verify the authenticated user matches the user_id in the request
    if (user.id !== user_id) {
      console.error("User ID mismatch - authenticated:", user.id, "requested:", user_id);
      return new Response(
        JSON.stringify({ error: "Unauthorized - User ID mismatch" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        }
      );
    }

    console.log("Processing registration for user:", user_id, "event:", event_id, "role:", role);

    const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://showya.in";

    // Get event details
    const { data: event, error: eventError } = await supabaseClient
      .from("events")
      .select("*, community_id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      console.error("Event not found:", eventError?.message);
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Construct meeting link dynamically
    const meetingLink = `${APP_BASE_URL}/events/${event_id}/join`;
    const eventPageLink = `${APP_BASE_URL}/events/${event_id}`;
    const dashboardLink = `${APP_BASE_URL}/events/${event_id}/dashboard`;

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

      // Send email with meeting link
      await supabaseClient.functions.invoke("send-notification-email", {
        body: {
          user_id: user_id,
          title: "Performance Details - Action Required",
          message: `You're confirmed as a performer for "${event.title}".\n\nMeeting Link: ${meetingLink}\n\nEvent Date: ${new Date(event.event_date).toLocaleString()}\n\nPlease review prerequisites and prepare for your performance.`,
          action_url: meetingLink,
        },
      });
    }

    // Send notification to audience with meeting link
    if (role === "audience") {
      await supabaseClient.from("notifications").insert({
        user_id: user_id,
        title: "You're In!",
        message: `You've joined "${event.title}" as audience. Event starts at ${new Date(event.event_date).toLocaleString()}.`,
        type: "success",
        category: "event",
        related_id: event_id,
        action_url: `/events/${event_id}`,
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
          action_url: dashboardLink,
        },
      });
    }

    console.log("Registration handled successfully for user:", user_id);

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
      JSON.stringify({ error: "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

serve(handler);
