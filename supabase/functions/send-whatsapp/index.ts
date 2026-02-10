import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WHATSAPP_API_VERSION = "v21.0";

interface WhatsAppRequest {
  to: string; // E.164 phone number e.g. +919876543210
  template_name: string;
  template_language?: string;
  template_parameters?: string[]; // body parameters
  // Optional: queue tracking
  message_queue_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");

    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.error("Missing WhatsApp configuration secrets");
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: WhatsAppRequest = await req.json();
    const { to, template_name, template_language = "en", template_parameters, message_queue_id } = body;

    if (!to || !template_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, template_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build template components
    const components: any[] = [];
    if (template_parameters && template_parameters.length > 0) {
      components.push({
        type: "body",
        parameters: template_parameters.map((value) => ({
          type: "text",
          text: value,
        })),
      });
    }

    const waPayload = {
      messaging_product: "whatsapp",
      to: to.replace(/[^+\d]/g, ""), // sanitize
      type: "template",
      template: {
        name: template_name,
        language: { code: template_language },
        ...(components.length > 0 ? { components } : {}),
      },
    };

    console.log("Sending WhatsApp template:", template_name, "to:", to);

    const waResponse = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(waPayload),
      }
    );

    const waResult = await waResponse.json();

    if (!waResponse.ok) {
      console.error("WhatsApp API error:", JSON.stringify(waResult));

      // Update message_queue if tracking
      if (message_queue_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        await supabase
          .from("message_queue")
          .update({
            status: "failed",
            error: JSON.stringify(waResult?.error || waResult),
            updated_at: new Date().toISOString(),
          })
          .eq("id", message_queue_id);
      }

      return new Response(
        JSON.stringify({ error: "WhatsApp API error", details: waResult }),
        { status: waResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = waResult?.messages?.[0]?.id;
    console.log("WhatsApp message sent successfully, id:", messageId);

    // Update message_queue if tracking
    if (message_queue_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await supabase
        .from("message_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: messageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", message_queue_id);
    }

    return new Response(
      JSON.stringify({ success: true, message_id: messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
