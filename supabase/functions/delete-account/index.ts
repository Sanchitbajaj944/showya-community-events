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

    console.log('Deleting account for user:', user.id);

    // Step 1: Get all communities owned by the user
    const { data: communities, error: communitiesError } = await supabaseClient
      .from('communities')
      .select('id')
      .eq('owner_id', user.id);

    if (communitiesError) {
      console.error('Error fetching communities:', communitiesError);
      throw communitiesError;
    }

    // Step 2: Delete razorpay accounts for these communities
    if (communities && communities.length > 0) {
      const communityIds = communities.map(c => c.id);
      
      const { error: razorpayError } = await supabaseClient
        .from('razorpay_accounts')
        .delete()
        .in('community_id', communityIds);

      if (razorpayError) {
        console.error('Error deleting razorpay accounts:', razorpayError);
        throw razorpayError;
      }
      
      console.log(`Deleted razorpay accounts for ${communityIds.length} communities`);
    }

    // Step 3: Delete the user from auth.users (will cascade delete profile and communities)
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      throw deleteError;
    }

    console.log('Account deleted successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-account:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
