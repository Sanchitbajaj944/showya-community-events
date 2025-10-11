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

    const { communityId } = await req.json();

    // Verify community ownership
    const { data: community, error: communityError } = await supabaseClient
      .from('communities')
      .select('*')
      .eq('id', communityId)
      .eq('owner_id', user.id)
      .single();

    if (communityError || !community) {
      throw new Error('Community not found or unauthorized');
    }

    // Check if Razorpay account already exists
    const { data: existingAccount } = await supabaseClient
      .from('razorpay_accounts')
      .select('*')
      .eq('community_id', communityId)
      .single();

    if (existingAccount) {
      // Account exists, fetch latest details from Razorpay
      const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
      const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
      const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

      try {
        // Fetch account details from Razorpay
        const response = await fetch(`https://api.razorpay.com/v2/accounts/${existingAccount.razorpay_account_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Error fetching Razorpay account:', errorData);
        } else {
          const accountData = await response.json();
          console.log('Fetched Razorpay account:', accountData);

          // Construct onboarding URL if not provided by Razorpay
          let onboardingUrl = accountData.onboarding_url;
          if (!onboardingUrl) {
            // Razorpay doesn't always return onboarding_url in API response
            // Construct it manually: https://dashboard.razorpay.com/app/onboarding/{account_id}
            onboardingUrl = `https://dashboard.razorpay.com/app/onboarding/${existingAccount.razorpay_account_id}`;
            console.log('Constructed onboarding URL:', onboardingUrl);
          }

          // Update database with onboarding URL
          if (onboardingUrl && onboardingUrl !== existingAccount.onboarding_url) {
            await supabaseClient
              .from('razorpay_accounts')
              .update({ 
                onboarding_url: onboardingUrl,
                last_updated: new Date().toISOString()
              })
              .eq('id', existingAccount.id);
            
            existingAccount.onboarding_url = onboardingUrl;
          }
        }
      } catch (error) {
        console.error('Error fetching Razorpay account:', error);
      }

      // Return appropriate response based on status
      if (existingAccount.kyc_status === 'ACTIVATED' || existingAccount.kyc_status === 'APPROVED') {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'KYC already activated',
            kyc_status: existingAccount.kyc_status
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if this is test mode
      const isTestMode = razorpayKeyId?.startsWith('rzp_test_');
      
      // Return status with test mode instructions if no real onboarding URL
      return new Response(
        JSON.stringify({ 
          success: true,
          razorpay_account_id: existingAccount.razorpay_account_id,
          kyc_status: existingAccount.kyc_status,
          test_mode: isTestMode,
          requires_webhook: isTestMode,
          message: isTestMode 
            ? 'TEST MODE: Razorpay account created. Use test webhooks to simulate KYC completion.'
            : 'Razorpay account exists. Waiting for KYC completion.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for KYC details
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('name, phone, street1, street2, city, state, postal_code')
      .eq('user_id', user.id)
      .single();

    // Validate required fields
    if (!profile) {
      throw new Error('Profile not found. Please complete your profile.');
    }

    if (!profile.street1 || !profile.city || !profile.state || !profile.postal_code) {
      throw new Error('Complete address information is required. Please update your address in the KYC section.');
    }

    // Use phone from profile, fallback to auth phone if available
    const userPhone = profile?.phone || user.phone || '';
    
    if (!userPhone) {
      throw new Error('Phone number is required for KYC. Please add your phone number in the profile.');
    }

    // Create new Razorpay linked account
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Truncate community ID to meet Razorpay's 20 character limit for reference_id
    const shortReferenceId = communityId.substring(0, 20);

    const accountPayload = {
      email: user.email,
      phone: userPhone,
      type: 'route',
      reference_id: shortReferenceId,
      legal_business_name: community.name,
      business_type: 'individual',
      contact_name: profile?.name || user.user_metadata?.name || 'Community Owner',
      profile: {
        category: 'others',
        subcategory: 'others',
        description: community.description || `${community.name} - Community Events`,
        addresses: {
          registered: {
            street1: profile.street1,
            street2: profile.street2 || '',
            city: profile.city,
            state: profile.state,
            postal_code: profile.postal_code,
            country: 'IN'
          }
        }
      },
      legal_info: {
        pan: '',
        gst: ''
      }
    };

    console.log('Creating Razorpay account with payload:', accountPayload);

    const response = await fetch('https://api.razorpay.com/v2/accounts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(accountPayload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Razorpay API error:', errorData);
      throw new Error(`Failed to create Razorpay account: ${errorData}`);
    }

    const accountData = await response.json();
    console.log('Razorpay account created:', accountData);

    // Check for real onboarding URL from Razorpay
    const onboardingUrl = accountData.onboarding_url || '';
    const isTestMode = razorpayKeyId?.startsWith('rzp_test_');
    
    console.log('Onboarding URL from Razorpay:', onboardingUrl);
    console.log('Test mode:', isTestMode);

    // Store Razorpay account in database
    const { error: insertError } = await supabaseClient
      .from('razorpay_accounts')
      .insert({
        community_id: communityId,
        razorpay_account_id: accountData.id,
        onboarding_url: onboardingUrl,
        kyc_status: 'IN_PROGRESS',
        last_updated: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error storing Razorpay account:', insertError);
      throw insertError;
    }

    // Update community KYC status
    await supabaseClient
      .from('communities')
      .update({ kyc_status: 'IN_PROGRESS' })
      .eq('id', communityId);

    // Return appropriate response based on mode and URL availability
    return new Response(
      JSON.stringify({ 
        success: true,
        razorpay_account_id: accountData.id,
        kyc_status: 'IN_PROGRESS',
        test_mode: isTestMode,
        requires_webhook: isTestMode && !onboardingUrl,
        onboarding_url: onboardingUrl || undefined,
        message: isTestMode && !onboardingUrl
          ? 'TEST MODE: Account created. Simulate KYC completion using Razorpay test webhooks.'
          : onboardingUrl 
          ? 'Redirecting to Razorpay for KYC completion...'
          : 'KYC process started'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in start-kyc:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
