import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { eventId } = await req.json();
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'Event ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for reads to bypass RLS
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch event details
    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('id, title, description, event_date, poster_url, ticket_type, performer_slots, performer_ticket_price, audience_enabled, audience_slots, audience_ticket_price, created_by, community_id, community_name, is_cancelled, jaas_room_name, allow_paid_audience_mic, allow_free_audience_mic, duration')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get participant counts
    const { data: counts } = await adminClient.rpc('get_event_participant_counts', { _event_id: eventId });
    const performerCount = counts?.[0]?.performer_count ?? 0;
    const audienceCount = counts?.[0]?.audience_count ?? 0;

    // Check if user already has a booking
    const { data: booking } = await adminClient
      .from('event_participants')
      .select('id, role, payment_status, amount_paid, mic_permission, ticket_code')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    const isHost = event.created_by === user.id;
    const audienceCap = event.audience_slots ?? 50;
    const audienceRemaining = Math.max(0, audienceCap - audienceCount);
    const performerRemaining = Math.max(0, event.performer_slots - performerCount);

    return new Response(
      JSON.stringify({
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          event_date: event.event_date,
          poster_url: event.poster_url,
          ticket_type: event.ticket_type,
          performer_slots: event.performer_slots,
          performer_ticket_price: event.performer_ticket_price,
          audience_enabled: event.audience_enabled,
          audience_slots: audienceCap,
          audience_ticket_price: event.audience_ticket_price ?? 0,
          community_name: event.community_name,
          community_id: event.community_id,
          is_cancelled: event.is_cancelled,
          allow_paid_audience_mic: event.allow_paid_audience_mic ?? true,
          allow_free_audience_mic: event.allow_free_audience_mic ?? false,
          duration: event.duration,
        },
        audienceRemaining,
        performerRemaining,
        booking: booking ? {
          id: booking.id,
          role: booking.role,
          payment_status: booking.payment_status,
          amount_paid: booking.amount_paid,
          mic_permission: booking.mic_permission,
          ticket_code: booking.ticket_code,
        } : null,
        isHost,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in get-join-context:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
