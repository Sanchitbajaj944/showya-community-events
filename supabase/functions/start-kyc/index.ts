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

    const { communityId, documents, bankDetails } = await req.json();

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
      .maybeSingle();

    if (existingAccount) {
      const status = existingAccount.kyc_status;
      
      // If KYC failed or rejected, require user to re-enter details
      if (status === 'FAILED' || status === 'REJECTED') {
        console.log('Previous KYC attempt failed/rejected. User must re-enter details.');
        return new Response(
          JSON.stringify({
            action: 'reenter_details',
            message: 'Your previous KYC attempt couldn\'t be verified. Please review your details and try again.',
            error_reason: existingAccount.error_reason || 'Verification failed',
            requires_user_input: true
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
      }
      
      // If KYC is pending, in progress, or verified, don't allow resubmission
      if (status === 'IN_PROGRESS' || status === 'PENDING' || status === 'VERIFIED') {
        console.log('KYC already in progress or pending approval.');
        const onboardingUrl = `https://dashboard.razorpay.com/app/route-accounts/${existingAccount.razorpay_account_id}/onboarding`;
        
        return new Response(
          JSON.stringify({
            action: 'wait',
            message: 'Your KYC is currently under review. You\'ll be notified once verified.',
            kyc_status: status,
            onboarding_url: onboardingUrl
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      // If already activated, return success
      if (status === 'ACTIVATED' || status === 'APPROVED') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'KYC already verified',
            kyc_status: status
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      // Delete failed account to start fresh KYC process
      console.log('Deleting previous failed account to start fresh KYC process...');
      await supabaseClient
        .from('razorpay_accounts')
        .delete()
        .eq('id', existingAccount.id);
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

    // Validate bank details
    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifsc || !bankDetails.beneficiaryName) {
      throw new Error('Bank account details are required for KYC.');
    }

    // Validate postal code (6 digits for India)
    const postalCodeDigits = profile.postal_code.replace(/\D/g, '');
    if (postalCodeDigits.length !== 6) {
      throw new Error('Postal code must be 6 digits.');
    }

    // Validate city and state (min 3 chars, allow letters, spaces, numbers, hyphens, and common special chars)
    if (profile.city.trim().length < 3) {
      throw new Error('City must be at least 3 characters long.');
    }

    if (profile.state.trim().length < 3) {
      throw new Error('State must be at least 3 characters long.');
    }

    // Validate and prepare street1 (must be 10-255 chars for Razorpay)
    let street1ForRazorpay = profile.street1.trim();
    
    // If street1 is too short and street2 is empty, append city to meet minimum length
    if (street1ForRazorpay.length < 10 && !profile.street2?.trim() && profile.city) {
      street1ForRazorpay = `${street1ForRazorpay}, ${profile.city.trim()}`;
    }
    
    // Final validation
    if (street1ForRazorpay.length < 10) {
      throw new Error('Address must be at least 10 characters long. Please include area or landmark.');
    }
    
    if (street1ForRazorpay.length > 255) {
      throw new Error('Address must be less than 255 characters.');
    }

    // Razorpay credentials
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials missing. Please contact support.');
    }
    
    console.log('Using Razorpay Key ID:', razorpayKeyId.substring(0, 8) + '...');
    
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

    // Use the validated and potentially auto-fixed street1
    const cappedStreet1 = street1ForRazorpay.substring(0, 255);

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

    console.log('Creating Razorpay account with FULL payload:', JSON.stringify(accountPayload, null, 2));
    console.log('Masked summary:', JSON.stringify({
      ...accountPayload,
      phone: '***' + accountPayload.phone.slice(-4),
      email: accountPayload.email ? accountPayload.email.replace(/(.{2}).*(@.*)/, '$1***$2') : 'N/A'
    }));
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
      console.error('Response status:', accountResponse.status);
      console.error('Response headers:', Object.fromEntries(accountResponse.headers.entries()));
      
      // Check if it's an authentication issue
      if (accountResponse.status === 401 || accountResponse.status === 403) {
        throw new Error('Razorpay authentication failed. Please verify your API credentials are correct and have the Route (Connected Accounts) feature enabled.');
      }
      
      // Check for "Access Denied" error which typically indicates test account limits
      if (errorData.includes('Access Denied')) {
        throw new Error('Razorpay test account limit reached. You have likely hit the maximum number of test accounts (typically 5-10). Please either: 1) Delete old test accounts from your Razorpay dashboard, or 2) Switch to live mode with production API keys. Contact support@razorpay.com if you need to increase test limits.');
      }
      
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
      relationship: {
        director: false,
        executive: true
      },
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

    // Step 4: Request Route product configuration
    let productId: string;
    try {
      const productResponse = await fetch(`https://api.razorpay.com/v2/accounts/${accountData.id}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_name: 'route',
          tnc_accepted: true,
          ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '0.0.0.0'
        })
      });

      if (!productResponse.ok) {
        const errorData = await productResponse.text();
        console.error('Product request failed:', errorData);
        throw new Error(`Failed to request Route product: ${errorData}`);
      }

      const productData = await productResponse.json();
      productId = productData.id;
      console.log('Route product requested:', productId);

      // Rate limit safety
      await new Promise(r => setTimeout(r, 200));

      // Step 5: Update product configuration with settlement bank account
      const settlementPayload = {
        settlements: {
          account_number: bankDetails.accountNumber,
          ifsc_code: bankDetails.ifsc,
          beneficiary_name: bankDetails.beneficiaryName
        },
        tnc_accepted: true,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '0.0.0.0'
      };

      console.log('Updating product configuration with settlement details...');
      const updateResponse = await fetch(`https://api.razorpay.com/v2/accounts/${accountData.id}/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settlementPayload)
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.text();
        console.error('Product update failed:', errorData);
        
        // Check if it's a locked form error (under review)
        if (errorData.includes('activation form locked') || errorData.includes('under_review')) {
          console.log('Form is locked - account is under review. This is expected.');
        } else {
          throw new Error(`Failed to update settlement details: ${errorData}`);
        }
      } else {
        const updateData = await updateResponse.json();
        console.log('Settlement details updated successfully:', updateData.activation_status);
      }
    } catch (error) {
      console.error('Failed to configure Route product:', error);
      throw new Error('Failed to activate payment products. Please contact support.');
    }

    // Store Razorpay account in database
    const onboardingUrl = `https://dashboard.razorpay.com/app/route-accounts/${accountData.id}/onboarding`;
    
    // Mask sensitive bank details for storage
    const maskedAccountNumber = `****${bankDetails.accountNumber.slice(-4)}`;
    
    const { error: insertError } = await supabaseClient
      .from('razorpay_accounts')
      .insert({
        community_id: communityId,
        razorpay_account_id: accountData.id,
        stakeholder_id: stakeholderData.id,
        product_id: productId,
        onboarding_url: onboardingUrl,
        kyc_status: 'IN_PROGRESS',
        business_type: 'individual',
        legal_business_name: sanitizedLegalBusinessName,
        bank_account_number: maskedAccountNumber,
        bank_ifsc: bankDetails.ifsc,
        bank_beneficiary_name: bankDetails.beneficiaryName,
        tnc_accepted: true,
        tnc_accepted_at: new Date().toISOString(),
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
