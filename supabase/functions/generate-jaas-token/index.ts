import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64URL encoding for JWT
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert ArrayBuffer to Base64URL
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

// Parse PEM private key
function parsePemKey(pem: string): string {
  return pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
    .replace(/-----END RSA PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
}

// Generate JWT token for JaaS
async function generateJaasToken(
  appId: string,
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
    kid: appId + '/default'
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (3 * 60 * 60); // 3 hours

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

  // Import the private key
  const pemContents = parsePemKey(privateKey);
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = arrayBufferToBase64Url(signature);
  
  return `${signingInput}.${encodedSignature}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const JAAS_APP_ID = Deno.env.get('JAAS_APP_ID');
    const JAAS_PRIVATE_KEY = Deno.env.get('JAAS_PRIVATE_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!JAAS_APP_ID) {
      throw new Error('JAAS_APP_ID is not configured');
    }
    if (!JAAS_PRIVATE_KEY) {
      throw new Error('JAAS_PRIVATE_KEY is not configured');
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase configuration missing');
    }

    // Verify auth token
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

    // Get the authenticated user
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

    // Get event details and check if user is registered
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, jaas_room_name, created_by, community_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is registered for the event
    const { data: participant, error: participantError } = await supabase
      .from('event_participants')
      .select('id, role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    // Check if user is the event creator
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
      
      // Update event with room name (only creator can do this)
      if (isCreator) {
        await supabase
          .from('events')
          .update({ jaas_room_name: roomName })
          .eq('id', eventId);
      }
    }

    // Determine if user is moderator (event creator or performer)
    const isModerator = isCreator || participant?.role === 'performer';

    // Generate JWT token
    const token = await generateJaasToken(
      JAAS_APP_ID,
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
        isModerator 
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
