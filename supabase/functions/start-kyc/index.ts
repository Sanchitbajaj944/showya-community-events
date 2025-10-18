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

    const { communityId, documents } = await req.json();

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
      // If products not yet requested, request them
      if (!existingAccount.products_requested && existingAccount.stakeholder_id) {
        await requestProducts(existingAccount.razorpay_account_id);
        
        await supabaseClient
          .from('razorpay_accounts')
          .update({ products_requested: true })
          .eq('id', existingAccount.id);
      }

      // Return existing account status
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

      // Construct onboarding URL
      const onboardingUrl = `https://dashboard.razorpay.com/app/route-accounts/${existingAccount.razorpay_account_id}/onboarding`;
      
      return new Response(
        JSON.stringify({ 
          success: true,
          razorpay_account_id: existingAccount.razorpay_account_id,
          kyc_status: existingAccount.kyc_status,
          onboarding_url: onboardingUrl,
          message: 'Redirecting to Razorpay KYC onboarding...'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for KYC details
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('name, phone, street1, street2, city, state, postal_code, pan, dob')
      .eq('user_id', user.id)
      .single();

    // Validate required fields
    if (!profile) {
      throw new Error('Profile not found. Please complete your profile.');
    }

    if (!profile.street1 || !profile.city || !profile.state || !profile.postal_code) {
      throw new Error('Complete address information is required.');
    }

    if (!profile.phone) {
      throw new Error('Phone number is required for KYC.');
    }

    if (!profile.pan) {
      throw new Error('PAN number is required for KYC.');
    }

    if (!profile.dob) {
      throw new Error('Date of birth is required for KYC.');
    }

    // Razorpay credentials
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Step 1: Create Razorpay account (v2 API)
    // Make reference_id unique by appending timestamp
    const timestamp = Date.now().toString().slice(-8);
    const shortReferenceId = `${communityId.substring(0, 12)}-${timestamp}`;
    const sanitizeDescription = (desc: string) => {
      return desc
        .replace(/[^a-zA-Z0-9\s\-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
    };

    const rawDescription = community.description || `${community.name} Community Events`;
    const sanitizedDescription = sanitizeDescription(rawDescription) || 'Community events and activities';

    const accountPayload = {
      email: user.email,
      phone: profile.phone,
      type: 'route',
      reference_id: shortReferenceId,
      legal_business_name: community.name,
      business_type: 'individual',
      contact_name: profile.name || user.user_metadata?.name || 'Community Owner',
      profile: {
        category: 'others',
        subcategory: 'others',
        description: sanitizedDescription,
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

    console.log('Creating Razorpay account...');
    const accountResponse = await fetch('https://api.razorpay.com/v2/accounts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(accountPayload)
    });

    if (!accountResponse.ok) {
      const errorData = await accountResponse.text();
      console.error('Razorpay account creation failed:', errorData);
      throw new Error(`Failed to create Razorpay account: ${errorData}`);
    }

    const accountData = await accountResponse.json();
    console.log('Razorpay account created:', accountData.id);

    // Step 2: Add stakeholder
    const stakeholderPayload = {
      name: profile.name || user.user_metadata?.name || 'Community Owner',
      email: user.email,
      phone: {
        primary: profile.phone,
        secondary: ''
      },
      percentage_ownership: 100,
      kyc: {
        pan: profile.pan,
        dob: profile.dob
      },
      addresses: {
        residential: {
          street: profile.street1,
          city: profile.city,
          state: profile.state,
          postal_code: profile.postal_code,
          country: 'IN'
        }
      }
    };

    console.log('Adding stakeholder...');
    const stakeholderResponse = await fetch(`https://api.razorpay.com/v2/accounts/${accountData.id}/stakeholders`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stakeholderPayload)
    });

    if (!stakeholderResponse.ok) {
      const errorData = await stakeholderResponse.text();
      console.error('Stakeholder creation failed:', errorData);
      throw new Error(`Failed to add stakeholder: ${errorData}`);
    }

    const stakeholderData = await stakeholderResponse.json();
    console.log('Stakeholder added:', stakeholderData.id);

    // Step 3: Upload documents if provided
    if (documents) {
      console.log('Uploading KYC documents...');
      
      // Upload PAN card
      if (documents.panCard) {
        await uploadDocument(
          accountData.id,
          stakeholderData.id,
          'individual_proof_of_identification',
          'personal_pan',
          documents.panCard,
          auth
        );
      }

      // Upload address proof
      if (documents.addressProof) {
        await uploadDocument(
          accountData.id,
          stakeholderData.id,
          'individual_proof_of_address',
          'voter_id_front',
          documents.addressProof,
          auth
        );
      }
    }

    // Step 4: Request products
    await requestProducts(accountData.id);

    // Store Razorpay account in database
    const onboardingUrl = `https://dashboard.razorpay.com/app/route-accounts/${accountData.id}/onboarding`;
    
    const { error: insertError } = await supabaseClient
      .from('razorpay_accounts')
      .insert({
        community_id: communityId,
        razorpay_account_id: accountData.id,
        stakeholder_id: stakeholderData.id,
        onboarding_url: onboardingUrl,
        kyc_status: 'IN_PROGRESS',
        products_requested: true,
        products_activated: false,
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

    // Return success with onboarding URL
    return new Response(
      JSON.stringify({ 
        success: true,
        razorpay_account_id: accountData.id,
        kyc_status: 'IN_PROGRESS',
        onboarding_url: onboardingUrl,
        message: 'Redirecting to Razorpay for KYC completion...'
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

// Helper function to upload documents to Razorpay
async function uploadDocument(
  accountId: string,
  stakeholderId: string,
  documentType: string,
  documentSubType: string,
  document: { name: string; type: string; data: string },
  auth: string
) {
  const formData = new FormData();
  
  // Convert base64 to blob
  const binaryData = Uint8Array.from(atob(document.data), c => c.charCodeAt(0));
  const blob = new Blob([binaryData], { type: document.type });
  
  formData.append('file', blob, document.name);
  formData.append('document_type', documentType);
  formData.append(documentSubType, 'true');

  const response = await fetch(
    `https://api.razorpay.com/v2/accounts/${accountId}/stakeholders/${stakeholderId}/documents`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`Document upload failed for ${documentType}:`, errorData);
    throw new Error(`Failed to upload ${documentType}`);
  }

  console.log(`Document uploaded: ${documentType}`);
  return await response.json();
}

// Helper function to request products
async function requestProducts(accountId: string) {
  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
  const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

  // Request payment gateway product
  console.log('Requesting payment_gateway product...');
  const pgResponse = await fetch(`https://api.razorpay.com/v2/accounts/${accountId}/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_name: 'payment_gateway',
      tnc_accepted: true
    })
  });

  if (!pgResponse.ok) {
    const errorData = await pgResponse.text();
    console.error('Payment gateway product request failed:', errorData);
  }

  // Request route product
  console.log('Requesting route product...');
  const routeResponse = await fetch(`https://api.razorpay.com/v2/accounts/${accountId}/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_name: 'route',
      tnc_accepted: true
    })
  });

  if (!routeResponse.ok) {
    const errorData = await routeResponse.text();
    console.error('Route product request failed:', errorData);
  }

  console.log('Products requested successfully');
}
