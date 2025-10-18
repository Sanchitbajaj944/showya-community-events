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

    // Validate postal code (6 digits for India)
    const postalCodeDigits = profile.postal_code.replace(/\D/g, '');
    if (postalCodeDigits.length !== 6) {
      throw new Error('Postal code must be 6 digits.');
    }

    // Validate city and state (min 3 chars, allow letters, spaces, and hyphens)
    if (profile.city.trim().length < 3 || !/^[a-zA-Z\s\-]+$/.test(profile.city.trim())) {
      throw new Error('City must be at least 3 characters and contain only letters, spaces, or hyphens.');
    }

    if (profile.state.trim().length < 3 || !/^[a-zA-Z\s\-]+$/.test(profile.state.trim())) {
      throw new Error('State must be at least 3 characters and contain only letters, spaces, or hyphens.');
    }

    // Validate street1 length (must be at least 10 chars when combined)
    const fullAddress = `${profile.street1.trim()} ${profile.street2?.trim() || ''}`.trim();
    if (fullAddress.length < 10) {
      throw new Error('Address must be at least 10 characters long.');
    }

    // Razorpay credentials
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials missing. Please contact support.');
    }
    
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Step 1: Create Razorpay account (v2 API)
    // Make reference_id unique, alphanumeric only, max 20 chars
    const timestamp = Date.now().toString().slice(-8);
    const cleanCommunityId = communityId.replace(/-/g, '').substring(0, 12);
    const shortReferenceId = `${cleanCommunityId}${timestamp}`;
    
    const sanitizeDescription = (desc: string) => {
      return desc
        .replace(/[^a-zA-Z0-9\s\-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
    };

    const sanitizeName = (name: string) => {
      const cleaned = name
        .replace(/[^a-zA-Z\s]/g, '') // Keep only letters and spaces
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
        .trim()
        .substring(0, 50); // Max 50 characters
      
      if (cleaned.length < 3) {
        throw new Error('Name must be at least 3 characters long.');
      }
      
      return cleaned;
    };

    const sanitizePhone = (phone: string): string => {
      const digitsOnly = phone.replace(/\D/g, '');
      // Remove country code if present (91 for India)
      const cleanPhone = digitsOnly.startsWith('91') && digitsOnly.length > 11 
        ? digitsOnly.substring(2) 
        : digitsOnly;
      
      if (cleanPhone.length < 8 || cleanPhone.length > 11) {
        throw new Error(`Phone number must be between 8 and 11 digits. Got: ${cleanPhone.length} digits`);
      }
      
      return cleanPhone;
    };

    const rawDescription = community.description || `${community.name} Community Events`;
    const sanitizedDescription = sanitizeDescription(rawDescription) || 'Community events and activities';

    const sanitizedPhone = sanitizePhone(profile.phone);
    const sanitizedContactName = sanitizeName(profile.name || user.user_metadata?.name || 'Community Owner');
    const sanitizedLegalBusinessName = sanitizeName(profile.name || user.user_metadata?.name || 'Community Owner');
    const sanitizedEmail = user.email?.toLowerCase().trim();

    // Cap street address to 255 characters
    const cappedStreet1 = fullAddress.substring(0, 255);

    const accountPayload = {
      email: sanitizedEmail,
      phone: sanitizedPhone,
      reference_id: shortReferenceId,
      legal_business_name: sanitizedLegalBusinessName,
      business_type: 'individual',
      contact_name: sanitizedContactName,
      profile: {
        category: 'others',
        subcategory: 'others',
        description: sanitizedDescription,
        addresses: {
          registered: {
            street1: cappedStreet1,
            street2: profile.street2?.trim() || '',
            city: profile.city.trim(),
            state: profile.state.trim(),
            postal_code: postalCodeDigits,
            country: 'IN'
          }
        }
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

    // Rate limit safety - small delay before next API call
    await new Promise(r => setTimeout(r, 200));

    // Step 2: Add stakeholder
    console.log('Adding stakeholder with masked PAN:', `****${profile.pan.slice(-4)}`);
    
    const stakeholderPayload = {
      name: sanitizedContactName,
      email: sanitizedEmail,
      phone: {
        primary: sanitizedPhone,
        secondary: ''
      },
      percentage_ownership: 100,
      kyc: {
        pan: profile.pan.trim()
      },
      addresses: {
        residential: {
          street1: cappedStreet1,
          city: profile.city.trim(),
          state: profile.state.trim(),
          postal_code: postalCodeDigits,
          country: 'IN'
        }
      }
    };

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

    // Rate limit safety - small delay before next API call
    await new Promise(r => setTimeout(r, 200));

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
        // Detect document type dynamically
        const docType = documents.addressProof.type || 'voter_id';
        const docSubType = docType === 'aadhaar' ? 'aadhaar_front' : 'voter_id_front';
        
        await uploadDocument(
          accountData.id,
          stakeholderData.id,
          'individual_proof_of_address',
          docSubType,
          documents.addressProof,
          auth
        );
      }
      
      // Rate limit safety
      await new Promise(r => setTimeout(r, 200));
    }

    // Step 4: Request products
    try {
      await requestProducts(accountData.id);
    } catch (error) {
      console.error('Failed to request products:', error);
      throw new Error('Failed to activate payment products. Please contact support.');
    }

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
    
    // Extract Razorpay error details if available
    let errorMessage = 'An error occurred during KYC setup';
    let errorField = null;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Try to parse Razorpay error format
      try {
        const razorpayError = JSON.parse(error.message);
        if (razorpayError.error) {
          errorMessage = razorpayError.error.description || errorMessage;
          errorField = razorpayError.error.field;
        }
      } catch {
        // Not a JSON error, use as is
      }
    }
    
    // Map technical errors to user-friendly messages
    const friendlyErrors: Record<string, string> = {
      'pan': 'Invalid PAN number. Please check and try again.',
      'phone': 'Invalid phone number. Please enter a valid 10-digit number.',
      'street': 'Address must be at least 10 characters long.',
      'street1': 'Address must be at least 10 characters long.',
      'postal_code': 'Invalid postal code. Please enter a valid 6-digit PIN code.',
      'email': 'Invalid email address.',
      'name': 'Name must contain only letters and be at least 3 characters long.',
    };
    
    if (errorField && friendlyErrors[errorField]) {
      errorMessage = friendlyErrors[errorField];
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        field: errorField
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
  
  // Validate file size (4 MB limit for images, 2 MB for PDFs)
  const maxSize = document.type.includes('pdf') ? 2 * 1024 * 1024 : 4 * 1024 * 1024;
  if (blob.size > maxSize) {
    throw new Error(`Document too large. Maximum size is ${maxSize / (1024 * 1024)} MB.`);
  }
  
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

  let pgSuccess = false;
  let routeSuccess = false;

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

  if (pgResponse.ok) {
    pgSuccess = true;
    console.log('Payment gateway product requested successfully');
  } else {
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

  if (routeResponse.ok) {
    routeSuccess = true;
    console.log('Route product requested successfully');
  } else {
    const errorData = await routeResponse.text();
    console.error('Route product request failed:', errorData);
  }

  // Throw error if both products failed
  if (!pgSuccess && !routeSuccess) {
    throw new Error('Failed to request payment products from Razorpay');
  }

  console.log('Products requested successfully');
}
