import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIXEL_ID = '3737772986526462';

interface ConversionEvent {
  event_name: string;
  event_time: number;
  action_source: string;
  event_source_url?: string;
  user_data: {
    em?: string[];  // hashed email
    ph?: string[];  // hashed phone
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;   // Facebook click ID
    fbp?: string;   // Facebook browser ID
    external_id?: string[];
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_name?: string;
    content_category?: string;
    content_ids?: string[];
    content_type?: string;
    num_items?: number;
  };
  event_id?: string;
}

// SHA-256 hash function for user data
async function sha256Hash(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    if (!META_ACCESS_TOKEN) {
      throw new Error('META_ACCESS_TOKEN is not configured');
    }

    const { 
      event_name, 
      user_id,
      email,
      phone,
      event_source_url,
      custom_data,
      event_id,
      client_ip_address,
      client_user_agent,
      fbc,
      fbp
    } = await req.json();

    if (!event_name) {
      return new Response(
        JSON.stringify({ error: 'event_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build user data with hashed values
    const user_data: ConversionEvent['user_data'] = {
      client_ip_address: client_ip_address || req.headers.get('x-forwarded-for') || undefined,
      client_user_agent: client_user_agent || req.headers.get('user-agent') || undefined,
    };

    if (email) {
      user_data.em = [await sha256Hash(email)];
    }

    if (phone) {
      // Remove any non-digit characters and hash
      const cleanPhone = phone.replace(/\D/g, '');
      user_data.ph = [await sha256Hash(cleanPhone)];
    }

    if (user_id) {
      user_data.external_id = [await sha256Hash(user_id)];
    }

    if (fbc) user_data.fbc = fbc;
    if (fbp) user_data.fbp = fbp;

    // Build the event
    const event: ConversionEvent = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data,
    };

    if (event_source_url) event.event_source_url = event_source_url;
    if (event_id) event.event_id = event_id;
    if (custom_data) event.custom_data = custom_data;

    console.log('Sending event to Meta:', JSON.stringify({ event_name, event_id }));

    // Send to Meta Conversion API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [event],
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta API error:', result);
      return new Response(
        JSON.stringify({ error: 'Failed to send event to Meta', details: result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Meta API response:', result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in meta-conversion-api:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
