import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { name, categories, description } = await req.json();

    // Check if user already has a community
    const { data: existingCommunity } = await supabaseClient
      .from('communities')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (existingCommunity) {
      throw new Error('You already have a community. Each user can only create one community.');
    }

    // Create community
    const { data: community, error: communityError } = await supabaseClient
      .from('communities')
      .insert({
        owner_id: user.id,
        name,
        categories,
        description,
        kyc_status: 'NOT_STARTED'
      })
      .select()
      .single();

    if (communityError) throw communityError;

    console.log('Community created successfully:', community.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        community,
        message: 'Community created successfully! You can set up payment acceptance later.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
