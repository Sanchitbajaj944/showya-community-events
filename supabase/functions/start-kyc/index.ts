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

    const { communityId, documents, bankDetails, checkOnly } = await req.json();

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

    // Check if Razorpay account already exists in our database
    const { data: existingAccount } = await supabaseClient
      .from('razorpay_accounts')
      .select('*')
      .eq('community_id', communityId)
      .maybeSingle();

    if (existingAccount) {
      const status = existingAccount.kyc_status;
      console.log('Found existing Razorpay account:', existingAccount.razorpay_account_id, 'Status:', status);
      
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
      
      // If KYC is pending or verified, show status
      if (status === 'PENDING' || status === 'VERIFIED') {
        console.log('KYC already submitted and under review.');
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
      
      // For IN_PROGRESS accounts
      if (status === 'IN_PROGRESS') {
        console.log('Account exists in IN_PROGRESS state.');
        
        // If this is just a check, tell frontend to proceed with forms
        if (checkOnly) {
          return new Response(
            JSON.stringify({
              action: 'proceed',
              message: 'Please complete your KYC details',
              existingAccount: true
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          );
        }
        // Otherwise continue with the flow using existing account
      }
      
      // If KYC failed or rejected, delete and start fresh
      if (status === 'FAILED' || status === 'REJECTED') {
        console.log('Previous KYC attempt failed. Will delete and start fresh.');
        await supabaseClient
          .from('razorpay_accounts')
          .delete()
          .eq('id', existingAccount.id);
      }
    }

    // If this is just a status check, return that no account exists
    if (checkOnly) {
      return new Response(
        JSON.stringify({
          action: 'proceed',
          message: 'No existing account found. Please provide KYC details.',
          existingAccount: false
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
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

    // Validate bank details
    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifsc || !bankDetails.beneficiaryName) {
      throw new Error('Bank account details are required for KYC.');
    }

    // Validate postal code (6 digits for India)
    const postalCodeDigits = profile.postal_code.replace(/\D/g, '');
    if (postalCodeDigits.length !== 6) {
      throw new Error('Postal code must be 6 digits.');
    }

    // Validate city and state (min 3 chars)
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

    // Helper functions for sanitization
    const sanitizeDescription = (desc: string) => {
      return desc
        .replace(/[^a-zA-Z0-9\s\-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
    };

    const sanitizeName = (name: string) => {
      const cleaned = name
        .replace(/[^a-zA-Z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);
      
      if (cleaned.length < 3) {
        throw new Error('Name must be at least 3 characters long.');
      }
      
      return cleaned;
    };

    const sanitizePhone = (phone: string): string => {
      const digitsOnly = phone.replace(/\D/g, '');
      const cleanPhone = digitsOnly.startsWith('91') && digitsOnly.length > 11 
        ? digitsOnly.substring(2) 
        : digitsOnly;
      
      if (cleanPhone.length < 8 || cleanPhone.length > 11) {
        throw new Error(`Phone number must be between 8 and 11 digits. Got: ${cleanPhone.length} digits`);
      }
      
      return cleanPhone;
    };

    // Prepare sanitized data
    const rawDescription = community.description || `${community.name} Community Events`;
    const sanitizedDescription = sanitizeDescription(rawDescription) || 'Community events and activities';
    const sanitizedPhone = sanitizePhone(profile.phone);
    const sanitizedContactName = sanitizeName(profile.name || user.user_metadata?.name || 'Community Owner');
    const sanitizedLegalBusinessName = sanitizeName(profile.name || user.user_metadata?.name || 'Community Owner');
    const sanitizedEmail = user.email?.toLowerCase().trim();
    const cappedStreet1 = street1ForRazorpay.substring(0, 255);

    // Check if we should use existing account or create new
    const shouldCreateNewAccount = !existingAccount || 
                                   existingAccount.kyc_status === 'FAILED' || 
                                   existingAccount.kyc_status === 'REJECTED' ||
                                   !existingAccount.razorpay_account_id;
    
    let razorpayAccountId: string;
    let razorpayStakeholderId: string | undefined;

    if (!shouldCreateNewAccount && existingAccount) {
      // Use existing account
      console.log('Using existing Razorpay account:', existingAccount.razorpay_account_id);
      razorpayAccountId = existingAccount.razorpay_account_id;
      razorpayStakeholderId = existingAccount.stakeholder_id || undefined;
    } else {
      // Create new Razorpay linked account
      const timestamp = Date.now().toString().slice(-8);
      const cleanCommunityId = communityId.replace(/-/g, '').substring(0, 12);
      const shortReferenceId = `${cleanCommunityId}${timestamp}`;

      const accountPayload = {
        email: sanitizedEmail,
        phone: sanitizedPhone,
        type: 'route',
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

      console.log('Creating Razorpay LINKED account (type: route) with v2 API');
      
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
        
        if (accountResponse.status === 401 || accountResponse.status === 403) {
          throw new Error('Razorpay authentication failed. Please verify your API credentials are correct and have the Route (Connected Accounts) feature enabled.');
        }
        
        // Handle email already exists - extract account ID and use it
        if (errorData.includes('email already exists') || errorData.includes('Merchant email already exists')) {
          console.log('Email already has a Razorpay account. Extracting account ID...');
          
          // Try to extract account ID from error message like "account - PHynOiaNmveGmy"
          const accountIdMatch = errorData.match(/account\s*-\s*([A-Za-z0-9]+)/);
          
          if (accountIdMatch && accountIdMatch[1]) {
            const existingAccountId = accountIdMatch[1];
            console.log('Found existing Razorpay account ID:', existingAccountId);
            
            // Save this account to our database so we can use it
            const { error: saveError } = await supabaseClient
              .from('razorpay_accounts')
              .insert({
                community_id: communityId,
                razorpay_account_id: existingAccountId,
                kyc_status: 'IN_PROGRESS',
                business_type: 'individual',
                legal_business_name: sanitizedLegalBusinessName,
                last_updated: new Date().toISOString()
              })
              .select()
              .single();
            
            if (saveError) {
              console.error('Failed to save existing account to database:', saveError);
              throw new Error('Found existing account but could not save it. Please contact support.');
            }
            
            // Use this account ID to continue the flow
            razorpayAccountId = existingAccountId;
            console.log('Successfully saved existing account. Continuing with KYC flow...');
          } else {
            console.error('Could not extract account ID from error:', errorData);
            throw new Error('This email is already associated with a Razorpay account but we could not identify it. Please contact support.');
          }
        } else {
          throw new Error(`Failed to create Razorpay linked account: ${errorData}`);
        }
      } else {
        const accountData = await accountResponse.json();
        console.log('Razorpay account created:', accountData.id);
        razorpayAccountId = accountData.id;
        
        // Save account to database immediately
        console.log('Saving account to database...');
        const { error: initialInsertError } = await supabaseClient
          .from('razorpay_accounts')
          .insert({
            community_id: communityId,
            razorpay_account_id: accountData.id,
            kyc_status: 'IN_PROGRESS',
            business_type: 'individual',
            legal_business_name: sanitizedLegalBusinessName,
            last_updated: new Date().toISOString()
          });
        
        if (initialInsertError) {
          console.error('Warning: Failed to save account to database:', initialInsertError);
        }
      }

    }

    await new Promise(r => setTimeout(r, 200));

    // Add stakeholder (if not already exists)
    if (!razorpayStakeholderId) {
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
            street: cappedStreet1,
            city: profile.city.trim(),
            state: profile.state.trim(),
            postal_code: postalCodeDigits,
            country: 'IN'
          }
        }
      };

      const stakeholderResponse = await fetch(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}/stakeholders`, {
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
      razorpayStakeholderId = stakeholderData.id;

      await new Promise(r => setTimeout(r, 200));
    } else {
      console.log('Using existing stakeholder:', razorpayStakeholderId);
    }

    // Upload documents if provided
    if (documents && razorpayStakeholderId) {
      console.log('Uploading KYC documents...');
      
      if (documents.panCard) {
        await uploadDocument(
          razorpayAccountId,
          razorpayStakeholderId,
          'individual_proof_of_identification',
          'personal_pan',
          documents.panCard,
          auth
        );
      }

      if (documents.addressProof) {
        const docType = documents.addressProof.type || 'voter_id';
        const docSubType = docType === 'aadhaar' ? 'aadhaar_front' : 'voter_id_front';
        
        await uploadDocument(
          razorpayAccountId,
          razorpayStakeholderId,
          'individual_proof_of_address',
          docSubType,
          documents.addressProof,
          auth
        );
      }
      
      await new Promise(r => setTimeout(r, 200));
    }

    // Request Route product configuration
    let productId: string;
    try {
      const productResponse = await fetch(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}/products`, {
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

      await new Promise(r => setTimeout(r, 200));

      // Update product configuration with settlement bank account
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
      const updateResponse = await fetch(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}/products/${productId}`, {
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

    // Update Razorpay account record with all details
    const onboardingUrl = `https://dashboard.razorpay.com/app/route-accounts/${razorpayAccountId}/onboarding`;
    const maskedAccountNumber = `****${bankDetails.accountNumber.slice(-4)}`;
    
    const { error: updateError } = await supabaseClient
      .from('razorpay_accounts')
      .update({
        stakeholder_id: razorpayStakeholderId,
        product_id: productId,
        onboarding_url: onboardingUrl,
        kyc_status: 'IN_PROGRESS',
        bank_account_number: maskedAccountNumber,
        bank_ifsc: bankDetails.ifsc,
        bank_beneficiary_name: bankDetails.beneficiaryName,
        tnc_accepted: true,
        tnc_accepted_at: new Date().toISOString(),
        products_requested: true,
        products_activated: false,
        last_updated: new Date().toISOString()
      })
      .eq('razorpay_account_id', razorpayAccountId)
      .eq('community_id', communityId);

    if (updateError) {
      console.error('Error updating Razorpay account:', updateError);
      throw updateError;
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
        razorpay_account_id: razorpayAccountId,
        kyc_status: 'IN_PROGRESS',
        onboarding_url: onboardingUrl,
        message: 'KYC process initiated successfully.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in start-kyc:', error);
    
    let errorMessage = 'An error occurred during KYC setup';
    let errorField = null;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
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
  
  const binaryData = Uint8Array.from(atob(document.data), c => c.charCodeAt(0));
  const blob = new Blob([binaryData], { type: document.type });
  
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
