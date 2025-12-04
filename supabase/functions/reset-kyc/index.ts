import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { communityId } = await req.json();

    if (!communityId) {
      return new Response(
        JSON.stringify({ error: 'Community ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Reset KYC request for community: ${communityId} by user: ${user.id}`);

    // Verify the user owns this community
    const { data: community, error: communityError } = await supabaseClient
      .from('communities')
      .select('id, owner_id, name')
      .eq('id', communityId)
      .single();

    if (communityError || !community) {
      console.error('Community not found:', communityError);
      return new Response(
        JSON.stringify({ error: 'Community not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (community.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You are not authorized to reset KYC for this community' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the existing Razorpay account
    const { data: razorpayAccount, error: accountError } = await supabaseClient
      .from('razorpay_accounts')
      .select('id, razorpay_account_id, kyc_status')
      .eq('community_id', communityId)
      .single();

    if (accountError && accountError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's fine, means nothing to delete
      console.error('Error fetching razorpay account:', accountError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch KYC account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!razorpayAccount) {
      console.log('No Razorpay account found to reset');
      // Still update community status to NOT_STARTED
      await supabaseClient
        .from('communities')
        .update({ kyc_status: 'NOT_STARTED' })
        .eq('id', communityId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No KYC account found. You can start fresh.',
          kyc_status: 'NOT_STARTED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Deleting Razorpay account: ${razorpayAccount.razorpay_account_id}`);

    // Delete any KYC documents first (foreign key constraint)
    const { error: docsError } = await supabaseClient
      .from('kyc_documents')
      .delete()
      .eq('community_id', communityId);

    if (docsError) {
      console.error('Error deleting KYC documents:', docsError);
      // Continue anyway - documents might not exist
    }

    // Delete the Razorpay account record
    const { error: deleteError } = await supabaseClient
      .from('razorpay_accounts')
      .delete()
      .eq('community_id', communityId);

    if (deleteError) {
      console.error('Error deleting razorpay account:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to reset KYC account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update community KYC status to NOT_STARTED
    const { error: updateError } = await supabaseClient
      .from('communities')
      .update({ kyc_status: 'NOT_STARTED' })
      .eq('id', communityId);

    if (updateError) {
      console.error('Error updating community status:', updateError);
      // Non-critical, continue
    }

    // Clear user's KYC-related profile data so they can re-enter fresh
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        phone: null,
        street1: null,
        street2: null,
        city: null,
        state: null,
        postal_code: null,
        pan: null,
        dob: null
      })
      .eq('user_id', user.id);

    if (profileError) {
      console.error('Error clearing profile KYC data:', profileError);
      // Non-critical, continue
    }

    console.log(`Successfully reset KYC for community: ${communityId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'KYC has been reset. You can now start fresh.',
        kyc_status: 'NOT_STARTED'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in reset-kyc:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
