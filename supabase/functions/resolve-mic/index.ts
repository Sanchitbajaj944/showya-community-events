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

    const { eventId, targetUserId, action } = await req.json();

    if (!eventId || !targetUserId || !action) {
      return new Response(
        JSON.stringify({ error: 'eventId, targetUserId, and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['grant', 'revoke'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Action must be "grant" or "revoke"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify caller is the event host
    const { data: event } = await adminClient
      .from('events')
      .select('created_by, title')
      .eq('id', eventId)
      .single();

    if (!event || event.created_by !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the event host can manage mic permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the target participant's mic_permission
    const newPermission = action === 'grant' ? 'granted' : 'revoked';

    const { error: updateError } = await adminClient
      .from('event_participants')
      .update({ mic_permission: newPermission })
      .eq('event_id', eventId)
      .eq('user_id', targetUserId);

    if (updateError) {
      throw updateError;
    }

    // Notify the target user
    const notificationTitle = action === 'grant' ? 'Mic Access Granted' : 'Mic Access Revoked';
    const notificationMessage = action === 'grant'
      ? `The host has approved your mic request in "${event.title}". You can now unmute.`
      : `The host has revoked your mic access in "${event.title}".`;

    await adminClient.from('notifications').insert({
      user_id: targetUserId,
      title: notificationTitle,
      message: notificationMessage,
      type: 'info',
      category: 'event',
      related_id: eventId,
    });

    return new Response(
      JSON.stringify({ success: true, mic_permission: newPermission }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in resolve-mic:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
