import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

function parsePemKey(pem: string): string {
  return pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
    .replace(/-----END RSA PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
}

async function generateJaasToken(
  appId: string,
  keyId: string,
  privateKey: string,
  roomName: string,
  userName: string,
  userEmail: string,
  userId: string,
  isModerator: boolean
): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: `${appId}/${keyId}`
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (3 * 60 * 60);

  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room: roomName,
    iat: now,
    nbf: now,
    exp: exp,
    context: {
      user: {
        id: userId,
        name: userName,
        email: userEmail,
        moderator: isModerator,
      },
      features: {
        livestreaming: false,
        recording: false,
        transcription: false,
        "outbound-call": false,
        "sip-outbound-call": false,
      },
    },
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const pemContents = parsePemKey(privateKey);
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = arrayBufferToBase64Url(signature);
  return `${signingInput}.${encodedSignature}`;
}

function determineMicPolicy(
  isCreator: boolean,
  participantRole: string | null,
  paymentStatus: string | null,
  allowPaidAudienceMic: boolean,
  allowFreeAudienceMic: boolean
): 'open' | 'request-only' | 'listen-only' {
  // Host and performers always have open mic
  if (isCreator || participantRole === 'performer') {
    return 'open';
  }

  // Audience members
  if (participantRole === 'audience') {
    const isPaid = paymentStatus === 'captured';
    if (isPaid && allowPaidAudienceMic) return 'request-only';
    if (!isPaid && allowFreeAudienceMic) return 'request-only';
    return 'listen-only';
  }

  return 'open';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const JAAS_APP_ID = Deno.env.get('JAAS_APP_ID');
    const JAAS_KEY_ID_RAW = Deno.env.get('JAAS_KEY_ID');
    const JAAS_PRIVATE_KEY = Deno.env.get('JAAS_PRIVATE_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!JAAS_APP_ID) throw new Error('JAAS_APP_ID is not configured');
    if (!JAAS_KEY_ID_RAW) throw new Error('JAAS_KEY_ID is not configured');

    // Strip appId prefix if user entered the full path (e.g. "appId/keyId" → "keyId")
    const JAAS_KEY_ID = JAAS_KEY_ID_RAW.includes('/')
      ? JAAS_KEY_ID_RAW.split('/').pop()!
      : JAAS_KEY_ID_RAW;
    
    console.log('Using kid:', `${JAAS_APP_ID}/${JAAS_KEY_ID}`);
    if (!JAAS_PRIVATE_KEY) throw new Error('JAAS_PRIVATE_KEY is not configured');
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase configuration missing');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { eventId } = await req.json();
    
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'Event ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get event details including mic settings
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, jaas_room_name, created_by, community_id, allow_paid_audience_mic, allow_free_audience_mic')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is registered
    const { data: participant, error: participantError } = await supabase
      .from('event_participants')
      .select('id, role, payment_status')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    const isCreator = event.created_by === user.id;

    if (!isCreator && (!participant || participantError)) {
      return new Response(
        JSON.stringify({ error: 'You must be registered for this event to join the meeting' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, display_name')
      .eq('user_id', user.id)
      .single();

    const userName = profile?.display_name || profile?.name || 'Participant';
    const userEmail = user.email || '';

    // Generate room name if not exists
    let roomName = event.jaas_room_name;
    if (!roomName) {
      roomName = `showya-event-${eventId.replace(/-/g, '').substring(0, 16)}`;
      if (isCreator) {
        await supabase
          .from('events')
          .update({ jaas_room_name: roomName })
          .eq('id', eventId);
      }
    }

    const isModerator = isCreator || participant?.role === 'performer';

    // Set meeting_status to 'live' when host joins
    if (isCreator) {
      await supabase
        .from('events')
        .update({ 
          meeting_status: 'live', 
          meeting_started_at: new Date().toISOString() 
        })
        .eq('id', eventId)
        .eq('meeting_status', 'scheduled');
    }

    // Determine mic policy
    const micPolicy = determineMicPolicy(
      isCreator,
      participant?.role || null,
      participant?.payment_status || null,
      (event as any).allow_paid_audience_mic ?? true,
      (event as any).allow_free_audience_mic ?? false
    );

    const token = await generateJaasToken(
      JAAS_APP_ID,
      JAAS_KEY_ID,
      JAAS_PRIVATE_KEY,
      roomName,
      userName,
      userEmail,
      user.id,
      isModerator
    );

    return new Response(
      JSON.stringify({ 
        token, 
        roomName,
        appId: JAAS_APP_ID,
        isModerator,
        isHost: isCreator,
        micPolicy,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error generating JaaS token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate token';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
