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

    // Try to initiate Razorpay account creation (non-blocking)
    // KYC can be completed later with proper user details
    try {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
      const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
      
      if (razorpayKeyId && razorpayKeySecret) {
        const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

        const accountResponse = await fetch('https://api.razorpay.com/v2/accounts', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            phone: '9999999999', // Placeholder - collect from user later
            type: 'route',
            reference_id: community.id,
            legal_business_name: name,
            business_type: 'individual',
            contact_name: profile?.name || 'Community Owner',
            profile: {
              category: 'events',
              subcategory: 'online_event',
              addresses: {
                registered: {
                  street1: '123 Main St',
                  street2: 'Suite 100',
                  city: 'Mumbai',
                  state: 'Maharashtra',
                  postal_code: '400001',
                  country: 'IN'
                }
              }
            },
            legal_info: {
              pan: 'AAAAA0000A', // Placeholder - needs real PAN
              gst: null
            }
          })
        });

        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          console.log('Razorpay account created:', accountData.id);

          // Store Razorpay account info
          await supabaseClient
            .from('razorpay_accounts')
            .insert({
              community_id: community.id,
              razorpay_account_id: accountData.id,
              kyc_status: 'IN_PROGRESS'
            });

          return new Response(
            JSON.stringify({ 
              success: true, 
              community,
              message: 'Community created! KYC process initiated with Razorpay.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const errorData = await accountResponse.json();
          console.error('Razorpay account creation failed (non-blocking):', errorData);
        }
      }
    } catch (razorpayError) {
      console.error('Razorpay setup error (non-blocking):', razorpayError);
    }

    // Return success even if Razorpay failed - KYC can be done later
    return new Response(
      JSON.stringify({ 
        success: true, 
        community,
        message: 'Community created successfully! Complete KYC setup to accept payments.'
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
