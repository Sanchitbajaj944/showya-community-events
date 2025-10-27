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
      const errorText = await response.text();
      console.error('Razorpay API error:', response.status, errorText);
      throw new Error(`Razorpay API error (${response.status}): ${errorText}`);
    }

    const accountData = await response.json();
    
    // Fetch products to get detailed requirements if account exists
    let productRequirements = null;
    let missingFields: string[] = [];
    let requirementErrors: any = {};
    let hostedOnboardingRequired = false;
    let bankConfigured = false;
    
    if (razorpayAccount.product_id) {
      try {
        const productResponse = await fetch(
          `https://api.razorpay.com/v2/accounts/${razorpayAccount.razorpay_account_id}/products/${razorpayAccount.product_id}`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
            }
          }
        );
        
        if (productResponse.ok) {
          const productData = await productResponse.json();
          console.log('Product activation status:', productData.activation_status);
          console.log('Product requirements:', JSON.stringify(productData.requirements, null, 2));
          console.log('Product config:', JSON.stringify(productData.config, null, 2));
          
          // Check if bank is configured
          bankConfigured = !!productData.config?.settlements?.bank_account;
          console.log('Bank configured in product:', bankConfigured);
          
          if (productData.requirements) {
            productRequirements = productData.requirements;
            missingFields = productData.requirements.currently_due || [];
            requirementErrors = productData.requirements.errors || {};
            
            // Check if hosted onboarding is required
            if (productData.requirements.hosted_onboarding_required) {
              hostedOnboardingRequired = true;
              console.log('⚠ Hosted onboarding is REQUIRED for this account');
            }
          }
          
          // Map product activation status to our status
          if (productData.activation_status === 'activated') {
            accountData.status = 'activated';
          } else if (productData.activation_status === 'needs_clarification') {
            accountData.status = 'needs_clarification';
          } else if (productData.activation_status === 'under_review') {
            accountData.status = 'under_review';
          }
        }
      } catch (productError) {
        console.error('Error fetching product details:', productError);
      }
    }
    
    let newStatus = 'IN_PROGRESS';

    if (accountData.status === 'activated') {
      newStatus = 'APPROVED';
    } else if (accountData.status === 'rejected' || accountData.status === 'suspended') {
      newStatus = 'REJECTED';
    } else if (accountData.status === 'needs_clarification' || missingFields.length > 0) {
      newStatus = 'NEEDS_INFO';
    } else if (accountData.status === 'under_review') {
      newStatus = 'PENDING';
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
        account_status: accountData.status,
        missing_fields: missingFields,
        requirement_errors: requirementErrors,
        requirements: productRequirements,
        hosted_onboarding_required: hostedOnboardingRequired,
        bank_configured: bankConfigured
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
