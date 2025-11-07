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

    const { event_id, amount } = await req.json();

    // Verify event exists and is paid
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error('Operation not permitted');
    }

    if (event.ticket_type !== 'paid') {
      throw new Error('This event has free tickets');
    }

    // Get community Razorpay account
    const { data: razorpayAccount } = await supabaseClient
      .from('razorpay_accounts')
      .select('razorpay_account_id, kyc_status')
      .eq('community_id', event.community_id)
      .single();

    if (!razorpayAccount || razorpayAccount.kyc_status !== 'ACTIVATED') {
      throw new Error('Community KYC not approved for payments');
    }

    // Create Razorpay order
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        notes: {
          event_id,
          user_id: user.id,
          event_name: event.title
        },
        transfers: [{
          account: razorpayAccount.razorpay_account_id,
          amount: Math.round(amount * 100 * 0.95), // 95% to community, 5% platform fee
          currency: 'INR',
          notes: {
            event_id,
            community_id: event.community_id
          }
        }]
      })
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error('Razorpay order creation failed:', errorData);
      throw new Error('Failed to create payment order');
    }

    const orderData = await orderResponse.json();

    return new Response(
      JSON.stringify({ 
        order_id: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        key_id: razorpayKeyId
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
