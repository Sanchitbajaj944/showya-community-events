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

    // Get user's community
    const { data: community, error: communityError } = await supabaseClient
      .from('communities')
      .select('id, kyc_status')
      .eq('owner_id', user.id)
      .single();

    if (communityError || !community) {
      throw new Error('No community found');
    }

    // Get Razorpay account details
    const { data: razorpayAccount } = await supabaseClient
      .from('razorpay_accounts')
      .select('*')
      .eq('community_id', community.id)
      .single();

    if (!razorpayAccount) {
      return new Response(
        JSON.stringify({ 
          kyc_status: community.kyc_status,
          message: 'No Razorpay account found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch latest status from Razorpay
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const response = await fetch(
      `https://api.razorpay.com/v2/accounts/${razorpayAccount.razorpay_account_id}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Razorpay account status');
    }

    const accountData = await response.json();
    let newStatus = 'IN_PROGRESS';

    if (accountData.status === 'activated') {
      newStatus = 'APPROVED';
    } else if (accountData.status === 'rejected' || accountData.status === 'suspended') {
      newStatus = 'REJECTED';
    }

    // Update status if changed
    if (newStatus !== razorpayAccount.kyc_status) {
      await supabaseClient
        .from('razorpay_accounts')
        .update({ 
          kyc_status: newStatus,
          last_updated: new Date().toISOString()
        })
        .eq('id', razorpayAccount.id);
    }

    return new Response(
      JSON.stringify({ 
        kyc_status: newStatus,
        razorpay_account_id: razorpayAccount.razorpay_account_id,
        account_status: accountData.status
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
