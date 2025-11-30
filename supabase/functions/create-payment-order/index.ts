import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PaymentOrderSchema = z.object({
  event_id: z.string().uuid('Invalid event ID format'),
  amount: z.number().min(1, 'Minimum amount is ₹1').max(1000000, 'Amount exceeds maximum')
});

// Helper to detect if request is from development environment
function isDevEnvironment(req: Request): boolean {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  
  const devPatterns = [
    'localhost',
    '127.0.0.1',
    'lovableproject.com',
    'lovable.app',
    'webcontainer.io'
  ];
  
  return devPatterns.some(pattern => 
    origin.includes(pattern) || referer.includes(pattern)
  );
}

// Get Razorpay credentials based on environment
function getRazorpayCredentials(req: Request): { keyId: string; keySecret: string; isTestMode: boolean } {
  const isDev = isDevEnvironment(req);
  
  if (isDev) {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID_TEST');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET_TEST');
    
    if (keyId && keySecret) {
      console.log('Using Razorpay TEST credentials (dev environment)');
      return { keyId, keySecret, isTestMode: true };
    }
    console.log('Test credentials not found, falling back to live');
  }
  
  console.log('Using Razorpay LIVE credentials');
  return {
    keyId: Deno.env.get('RAZORPAY_KEY_ID') || '',
    keySecret: Deno.env.get('RAZORPAY_KEY_SECRET') || '',
    isTestMode: false
  };
}

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

    // Get community details with platform fee
    const { data: community } = await supabaseClient
      .from('communities')
      .select('platform_fee_percentage')
      .eq('id', event.community_id)
      .single();

    // Get community Razorpay account
    const { data: razorpayAccount } = await supabaseClient
      .from('razorpay_accounts')
      .select('razorpay_account_id, kyc_status')
      .eq('community_id', event.community_id)
      .single();

    if (!razorpayAccount || razorpayAccount.kyc_status !== 'ACTIVATED') {
      throw new Error('Community KYC not approved for payments');
    }

    // Ensure minimum amount after platform fees
    const platformFeePercentage = community?.platform_fee_percentage || 5;
    const transferAmount = amount * (1 - platformFeePercentage / 100);
    
    if (transferAmount < 1) {
      throw new Error(`Minimum payment amount is ₹${Math.ceil(1 / (1 - platformFeePercentage / 100))} after platform fees`);
    }

    // Create Razorpay order with environment-appropriate credentials
    const { keyId: razorpayKeyId, keySecret: razorpayKeySecret, isTestMode } = getRazorpayCredentials(req);
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    
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
          amount: Math.round(amount * 100 * (1 - (community?.platform_fee_percentage || 5) / 100)), // Dynamic platform fee
          currency: 'INR',
          notes: {
            event_id,
            community_id: event.community_id,
            platform_fee_percentage: community?.platform_fee_percentage || 5
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
