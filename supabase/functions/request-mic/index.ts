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

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get participant record
    const { data: participant, error: participantError } = await adminClient
      .from('event_participants')
      .select('id, role, payment_status, mic_permission')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({ error: 'You are not registered for this event' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only paid audience can request mic
    if (participant.role !== 'audience' || participant.payment_status !== 'captured') {
      return new Response(
        JSON.stringify({ error: 'Only paid audience members can request mic access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check event allows paid audience mic
    const { data: event } = await adminClient
      .from('events')
      .select('allow_paid_audience_mic, created_by, title')
      .eq('id', eventId)
      .single();

    if (!event?.allow_paid_audience_mic) {
      return new Response(
        JSON.stringify({ error: 'Mic requests are not enabled for this event' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check current mic_permission state
    if (participant.mic_permission === 'granted') {
      return new Response(
        JSON.stringify({ error: 'Mic already granted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (participant.mic_permission === 'requested') {
      return new Response(
        JSON.stringify({ error: 'Mic request already pending' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update mic_permission to requested
    const { error: updateError } = await adminClient
      .from('event_participants')
      .update({ mic_permission: 'requested' })
      .eq('id', participant.id);

    if (updateError) {
      throw updateError;
    }

    // Notify the host
    const { data: profile } = await adminClient
      .from('profiles')
      .select('name, display_name')
      .eq('user_id', user.id)
      .single();

    const userName = profile?.display_name || profile?.name || 'A participant';

    await adminClient.from('notifications').insert({
      user_id: event.created_by,
      title: 'Mic Request',
      message: `${userName} is requesting mic access in "${event.title}"`,
      type: 'info',
      category: 'event',
      related_id: eventId,
      action_url: `/events/${eventId}/join`,
    });

    return new Response(
      JSON.stringify({ success: true, mic_permission: 'requested' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in request-mic:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
