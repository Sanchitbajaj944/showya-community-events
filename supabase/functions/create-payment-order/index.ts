import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PaymentOrderSchema = z.object({
  event_id: z.string().uuid('Invalid event ID format'),
  amount: z.number().min(1, 'Minimum amount is ₹1').max(1000000, 'Amount exceeds maximum'),
  mode: z.enum(['test', 'live']).optional().default('test'),
});

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

    const requestBody = await req.json();
    const validationResult = PaymentOrderSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { event_id, amount } = validationResult.data;

    // Determine effective mode
    let isTestMode: boolean;
    const requestedMode = validationResult.data.mode;

    if (requestedMode === 'live') {
      const { data: adminRole } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      const isProduction = Deno.env.get('ENVIRONMENT') === 'production';

      if (!isProduction && !adminRole) {
        return new Response(
          JSON.stringify({ error: 'Live payments are disabled in non-production.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      isTestMode = false;
    } else {
      isTestMode = true;
    }

    const razorpayKeyId = isTestMode
      ? Deno.env.get('RAZORPAY_KEY_ID_TEST') || ''
      : Deno.env.get('RAZORPAY_KEY_ID') || '';
    const razorpayKeySecret = isTestMode
      ? Deno.env.get('RAZORPAY_KEY_SECRET_TEST') || ''
      : Deno.env.get('RAZORPAY_KEY_SECRET') || '';

    console.log(`Using Razorpay ${isTestMode ? 'TEST' : 'LIVE'} credentials (mode: ${requestedMode})`);

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

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

    let razorpayAccountId: string | null = null;
    let platformFeePercentage = 5;

    if (!isTestMode) {
      // In live mode, require community KYC and linked account
      const { data: community } = await supabaseClient
        .from('communities')
        .select('platform_fee_percentage')
        .eq('id', event.community_id)
        .single();

      const { data: razorpayAccount } = await supabaseClient
        .from('razorpay_accounts')
        .select('razorpay_account_id, kyc_status')
        .eq('community_id', event.community_id)
        .single();

      if (!razorpayAccount || razorpayAccount.kyc_status !== 'ACTIVATED') {
        throw new Error('Community KYC not approved for payments');
      }

      razorpayAccountId = razorpayAccount.razorpay_account_id;
      platformFeePercentage = community?.platform_fee_percentage || 5;
    } else {
      // In test mode, skip KYC validation - just get platform fee if available
      const { data: community } = await supabaseClient
        .from('communities')
        .select('platform_fee_percentage')
        .eq('id', event.community_id)
        .single();

      platformFeePercentage = community?.platform_fee_percentage || 5;
      console.log('Test mode: Skipping KYC validation');
    }

    // Ensure minimum amount after platform fees
    const transferAmount = amount * (1 - platformFeePercentage / 100);
    
    if (transferAmount < 1) {
      throw new Error(`Minimum payment amount is ₹${Math.ceil(1 / (1 - platformFeePercentage / 100))} after platform fees`);
    }
    
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Build order payload
    const orderPayload: Record<string, unknown> = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      notes: {
        event_id,
        user_id: user.id,
        event_name: event.title,
        is_test_mode: isTestMode
      }
    };

    // Only add transfers for live mode with a valid linked account
    if (!isTestMode && razorpayAccountId) {
      orderPayload.transfers = [{
        account: razorpayAccountId,
        amount: Math.round(amount * 100 * (1 - platformFeePercentage / 100)),
        currency: 'INR',
        notes: {
          event_id,
          community_id: event.community_id,
          platform_fee_percentage: platformFeePercentage
        }
      }];
    }

    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload)
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
