import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to extract valid public IPv4 for compliance
const getValidIp = (req: Request, { allowFallback = true } = {}): string => {
  const headers = [
    'x-forwarded-for', 'x-client-ip', 'true-client-ip', 'cf-connecting-ip', 'x-real-ip'
  ].map(h => req.headers.get(h) || '').filter(Boolean);

  const candidates = headers.flatMap(v => v.split(',')).map(s => s.trim()).filter(Boolean);

  const isIPv4 = (ip: string) =>
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ip);
  const isPrivate = (ip: string) =>
    /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    /^127\./.test(ip) || /^169\.254\./.test(ip);

  for (const ip of candidates) if (isIPv4(ip) && !isPrivate(ip)) return ip;

  // Fallback for TEST mode only; LIVE should fail if no public IP
  return allowFallback ? '49.207.192.1' : '';
};

// Wrapper to surface Razorpay errors with field info
async function callRazorpay(url: string, opts: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    try {
      const j = JSON.parse(text);
      const errMsg = j?.error?.description || text;
      const errField = j?.error?.field || null;
      throw new Error(JSON.stringify({ error: errMsg, field: errField }));
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('{')) throw e;
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  try { return JSON.parse(text); } catch { return text; }
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

    const clientIp = getValidIp(req);

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

    // If this is just a status check and no DB record exists, check Razorpay too
    if (checkOnly) {
      // Get user email to check if account exists in Razorpay
      const userEmail = user.email?.toLowerCase().trim();
      
      if (userEmail) {
        // Try to find account in Razorpay by attempting to list accounts
        const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
        const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
        const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
        
        try {
          // Try to find if account exists by checking for this email
          // We'll attempt to create a minimal account to see if it already exists
          const testResponse = await fetch('https://api.razorpay.com/v2/accounts', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: userEmail,
              phone: '1234567890', // Dummy phone for test
              type: 'route',
              reference_id: `test_${Date.now()}`,
              legal_business_name: 'Test',
              business_type: 'individual',
              contact_name: 'Test'
            })
          });
          
          const responseText = await testResponse.text();
          
          // If we get "email already exists" error, account exists in Razorpay
          if (responseText.includes('email already exists') || responseText.includes('Merchant email already exists')) {
            console.log('Found existing Razorpay account for email during checkOnly');
            
            // Try to extract the account ID
            const accountIdMatch = responseText.match(/account\s*-\s*([A-Za-z0-9]+)/);
            
            if (accountIdMatch && accountIdMatch[1]) {
              const existingAccountId = accountIdMatch[1];
              console.log('Existing Razorpay account ID:', existingAccountId);
              
              // Save this to our database for future use
              await supabaseClient
                .from('razorpay_accounts')
                .upsert({
                  community_id: communityId,
                  razorpay_account_id: existingAccountId,
                  kyc_status: 'IN_PROGRESS',
                  business_type: 'individual',
                  last_updated: new Date().toISOString()
                }, {
                  onConflict: 'razorpay_account_id'
                });
              
              return new Response(
                JSON.stringify({
                  action: 'proceed',
                  message: 'Found existing Razorpay account. Please complete your KYC details.',
                  existingAccount: true
                }),
                { 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 200
                }
              );
            }
          }
        } catch (e) {
          console.log('Error checking Razorpay for existing account:', e);
          // Continue with normal flow
        }
      }
      
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
            
            // Save or update this account in our database
            const { error: saveError } = await supabaseClient
              .from('razorpay_accounts')
              .upsert({
                community_id: communityId,
                razorpay_account_id: existingAccountId,
                kyc_status: 'IN_PROGRESS',
                business_type: 'individual',
                legal_business_name: sanitizedLegalBusinessName,
                last_updated: new Date().toISOString()
              }, {
                onConflict: 'razorpay_account_id'
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
        
        // Save or update account in database immediately
        console.log('Saving account to database...');
        const { error: initialInsertError } = await supabaseClient
          .from('razorpay_accounts')
          .upsert({
            community_id: communityId,
            razorpay_account_id: accountData.id,
            kyc_status: 'IN_PROGRESS',
            business_type: 'individual',
            legal_business_name: sanitizedLegalBusinessName,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'razorpay_account_id'
          });
        
        if (initialInsertError) {
          console.error('Warning: Failed to save account to database:', initialInsertError);
        }
      }

    }

    await new Promise(r => setTimeout(r, 200));

     // Add stakeholder (if not already exists)
    let canAccessAccount = true;
    if (!razorpayStakeholderId) {
      // First, try to fetch existing stakeholders
      console.log('Checking for existing stakeholders...');
      const fetchStakeholdersResponse = await fetch(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}/stakeholders`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        }
      });

      if (fetchStakeholdersResponse.ok) {
        const existingStakeholders = await fetchStakeholdersResponse.json();
        console.log('Found existing stakeholders:', existingStakeholders.items?.length || 0);
        
        // If stakeholders exist, use the first one
        if (existingStakeholders.items && existingStakeholders.items.length > 0) {
          razorpayStakeholderId = existingStakeholders.items[0].id;
          console.log('Using existing stakeholder:', razorpayStakeholderId);
        }
      } else if (fetchStakeholdersResponse.status === 403 || fetchStakeholdersResponse.status === 401) {
        console.log('Cannot access account via API. Account may need manual setup.');
        canAccessAccount = false;
      }

      // Only create stakeholder if none exists and we have access
      if (!razorpayStakeholderId && canAccessAccount) {
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
              street: street1ForRazorpay,
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
          
          // If access denied, mark account as needing manual setup
          if (errorData.includes('Access Denied') || stakeholderResponse.status === 403) {
            console.log('Access denied. Account requires manual setup in Razorpay dashboard.');
            canAccessAccount = false;
          } else {
            throw new Error(`Failed to add stakeholder: ${errorData}`);
          }
        } else {
          const stakeholderData = await stakeholderResponse.json();
          console.log('Stakeholder added:', stakeholderData.id);
          razorpayStakeholderId = stakeholderData.id;
        }
      }

      await new Promise(r => setTimeout(r, 200));
    } else {
      console.log('Using existing stakeholder:', razorpayStakeholderId);
    }

    // If we can't access the account, skip remaining steps and inform user
    if (!canAccessAccount) {
      console.log('Skipping remaining KYC steps due to access restrictions.');
      
      // Update database with what we know
      const { error: updateError } = await supabaseClient
        .from('razorpay_accounts')
        .upsert({
          community_id: communityId,
          razorpay_account_id: razorpayAccountId,
          kyc_status: 'PENDING',
          business_type: 'individual',
          legal_business_name: sanitizedLegalBusinessName,
          error_reason: 'Account requires manual KYC completion in Razorpay dashboard',
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'community_id'
        });

      if (updateError) {
        console.error('Failed to update database:', updateError);
      }

      const manualOnboardingUrl = `https://dashboard.razorpay.com/app/route-accounts/${razorpayAccountId}/onboarding`;
      
      return new Response(
        JSON.stringify({
          action: 'manual_setup',
          message: 'Your Razorpay account exists but requires manual completion. Please complete KYC in your Razorpay dashboard.',
          onboarding_url: manualOnboardingUrl,
          razorpay_account_id: razorpayAccountId
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Check product requirements before uploading documents
    let requiredDocuments: string[] = [];
    if (documents && razorpayStakeholderId) {
      // Fetch product to check document requirements
      try {
        const productCheckResponse = await fetch(
          `https://api.razorpay.com/v2/accounts/${razorpayAccountId}/products`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (productCheckResponse.ok) {
          const productsData = await productCheckResponse.json();
          // Get the route product
          const routeProduct = productsData.items?.find((p: any) => p.product_name === 'route');
          requiredDocuments = routeProduct?.requirements?.documents || [];
          console.log('Required documents:', requiredDocuments);
        }
      } catch (err) {
        console.error('Failed to fetch product requirements:', err);
        // Continue with default behavior if check fails
        requiredDocuments = ['individual_proof_of_address'];
      }

      console.log('Uploading required KYC documents...');
      
      // Only upload PAN image if explicitly required
      const needIdProof = requiredDocuments.includes('individual_proof_of_identification');
      if (needIdProof && documents.panCard) {
        try {
          await uploadDocument(
            razorpayAccountId,
            razorpayStakeholderId,
            'individual_proof_of_identification',
            'personal_pan',
            documents.panCard,
            auth
          );
        } catch (err: any) {
          const errorMsg = String(err.message || err);
          if (errorMsg.includes('personal_pan is/are not required')) {
            console.warn('PAN image not required for this account; skipping.');
          } else {
            throw err;
          }
        }
      } else if (documents.panCard) {
        console.log('PAN image not required according to product requirements; skipping upload.');
      }

      // Upload address proof if required
      const needAddrProof = requiredDocuments.includes('individual_proof_of_address');
      if (needAddrProof && documents.addressProof) {
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
      } else if (documents.addressProof) {
        console.log('Address proof not required according to product requirements; skipping upload.');
      }
      
      await new Promise(r => setTimeout(r, 200));
    }

    // Try to set bank details at account level BEFORE requesting product
    console.log('Setting bank details at account level...');
    const accountBankPayload = {
      bank_account: {
        ifsc_code: bankDetails.ifsc,
        account_number: bankDetails.accountNumber,
        beneficiary_name: bankDetails.beneficiaryName
      }
    };
    
    console.log('PATCH account with bank (masked):', {
      bank_account: {
        ifsc_code: bankDetails.ifsc,
        account_number: '****' + bankDetails.accountNumber.slice(-4),
        beneficiary_name: bankDetails.beneficiaryName
      }
    });

    try {
      const accountBankResponse = await fetch(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'X-Razorpay-Idempotency': `showya_${communityId}_acc_bank`
        },
        body: JSON.stringify(accountBankPayload)
      });

      const accBankReqId = accountBankResponse.headers.get('x-razorpay-request-id');
      console.log('Account bank PATCH request ID:', accBankReqId);

      if (accountBankResponse.ok) {
        const accountData = await accountBankResponse.json();
        console.log('Account bank details updated, status:', accountData.status);
      } else {
        const errorText = await accountBankResponse.text();
        console.warn('Account bank PATCH failed (non-fatal):', errorText);
        // Continue anyway - will try product-level next
      }
    } catch (err: any) {
      console.warn('Account-level bank update failed (non-fatal):', err.message);
      // Continue anyway
    }

    await new Promise(r => setTimeout(r, 300));

    // Request Route product configuration
    let productId: string;
    let finalStatus = 'IN_PROGRESS';
    try {
      console.log('Requesting Route product...');
      const productData = await callRazorpay(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'X-Razorpay-Idempotency': `showya_${communityId}_prd_request_route`
        },
        body: JSON.stringify({
          product_name: 'route',
          tnc_accepted: true,
          settlements: {
            account_number: bankDetails.accountNumber,
            ifsc_code: bankDetails.ifsc,
            beneficiary_name: bankDetails.beneficiaryName
          }
        })
      });

      productId = productData.id;
      console.log('Route product requested:', productId);

      await new Promise(r => setTimeout(r, 500));

      // Fetch product requirements to conditionally upload docs
      console.log('Fetching product requirements...');
      const productDetails = await callRazorpay(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}/products/${productId}`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` }
      });

      const requiredDocs = productDetails?.requirements?.documents || [];
      console.log('Required documents:', requiredDocs);

      // Verify bank details were configured
      console.log('Verifying bank configuration in product...');
      const bankConfigured = !!productDetails.config?.settlements?.bank_account || 
                            !!productDetails.config?.settlements?.account_number;
      const bankInSettings = !!productDetails.settlements;
      
      console.log('✓ Bank in config:', bankConfigured);
      console.log('✓ Bank in settings:', bankInSettings);
      console.log('  Product status:', productDetails.activation_status);
      console.log('  Requirements:', JSON.stringify(productDetails.requirements?.currently_due || []));
      
      if (!bankConfigured && !bankInSettings) {
        console.warn('⚠️ Bank details not auto-configured. Trying product PATCH...');
        
        // Fallback: try PATCH on product
        const settlementPayload = {
          settlements: {
            bank_account: {
              name: bankDetails.beneficiaryName,
              ifsc: bankDetails.ifsc,
              account_number: bankDetails.accountNumber
            }
          },
          tnc_accepted: true
        };

        console.log('PATCH product with bank (masked):', {
          settlements: {
            bank_account: {
              name: bankDetails.beneficiaryName,
              ifsc: bankDetails.ifsc,
              account_number: '****' + bankDetails.accountNumber.slice(-4)
            }
          }
        });
        
        try {
          const updateResponse = await fetch(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}/products/${productId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
              'X-Razorpay-Idempotency': `showya_${communityId}_prd_${productId}_settlement`
            },
            body: JSON.stringify(settlementPayload)
          });

          const requestId = updateResponse.headers.get('x-razorpay-request-id');
          console.log('Product PATCH request ID:', requestId);

          if (updateResponse.ok) {
            const updateData = await updateResponse.json();
            console.log('Product PATCH status:', updateData.activation_status);
            
            // Re-check
            await new Promise(r => setTimeout(r, 300));
            const recheckResponse = await fetch(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}/products/${productId}`, {
              method: 'GET',
              headers: { 'Authorization': `Basic ${auth}` }
            });
            
            if (recheckResponse.ok) {
              const recheckedProduct = await recheckResponse.json();
              const nowConfigured = !!recheckedProduct.config?.settlements?.bank_account;
              console.log('After PATCH - Bank configured:', nowConfigured);
              
              if (!nowConfigured) {
                console.warn('⚠️ Bank still not in config after PATCH. Hosted onboarding may be required.');
              }
            }
          } else {
            const errorText = await updateResponse.text();
            console.warn('Product PATCH failed (non-fatal):', errorText);
          }
        } catch (err: any) {
          console.warn('Product PATCH error (non-fatal):', err.message);
        }
      }

      // Final status check
      const finalProduct = await callRazorpay(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}/products/${productId}`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` }
      });

      console.log('Final product status:', finalProduct.activation_status);
      console.log('Requirements:', finalProduct.requirements);
      const finalBankConfigured = !!finalProduct.config?.settlements?.bank_account;
      console.log('Final bank configured:', finalBankConfigured);

      // Check if hosted onboarding is required for bank details
      const requiresHostedOnboarding = !finalBankConfigured && 
        finalProduct.requirements?.currently_due?.some((req: any) => 
          req?.field_reference?.includes('settlements.')
        );

      if (requiresHostedOnboarding) {
        console.log('🔔 Hosted onboarding required for bank details');
        
        // Get the onboarding URL
        const accountResponse = await fetch(`https://api.razorpay.com/v2/accounts/${razorpayAccountId}`, {
          method: 'GET',
          headers: { 'Authorization': `Basic ${auth}` }
        });
        
        let onboardingUrl = null;
        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          onboardingUrl = accountData.activation_url || accountData.onboarding_url;
          console.log('Hosted onboarding URL:', onboardingUrl ? 'Available' : 'Not found');
        }
        
        // Save with onboarding URL
        const maskedAccountNumber = `****${bankDetails.accountNumber.slice(-4)}`;
        await supabaseClient
          .from('razorpay_accounts')
          .update({
            stakeholder_id: razorpayStakeholderId,
            product_id: productId,
            onboarding_url: onboardingUrl,
            kyc_status: 'NEEDS_INFO',
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
        
        await supabaseClient
          .from('communities')
          .update({ kyc_status: 'NEEDS_INFO' })
          .eq('id', communityId);
        
        return new Response(
          JSON.stringify({ 
            success: false,
            action: 'hosted_onboarding_required',
            kyc_status: 'NEEDS_INFO',
            onboarding_url: onboardingUrl,
            message: 'Bank details must be completed on Razorpay. Click "Complete Bank Setup" to continue.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map status for frontend
      if (finalProduct.activation_status === 'activated') {
        finalStatus = 'ACTIVATED';
      } else if (finalProduct.activation_status === 'under_review') {
        finalStatus = 'PENDING';
      } else if (finalProduct.activation_status === 'needs_clarification') {
        finalStatus = 'NEEDS_INFO';
      }
    } catch (error: any) {
      console.error('Failed to configure Route product:', error);
      // Try to parse structured error
      try {
        const parsed = JSON.parse(error.message);
        throw new Error(JSON.stringify(parsed));
      } catch {
        throw error;
      }
    }

    // Save to database (NO onboarding_url for embedded)
    const maskedAccountNumber = `****${bankDetails.accountNumber.slice(-4)}`;
    
    const { error: updateError } = await supabaseClient
      .from('razorpay_accounts')
      .update({
        stakeholder_id: razorpayStakeholderId,
        product_id: productId,
        onboarding_url: null, // Embedded mode - no dashboard redirects
        kyc_status: finalStatus,
        bank_account_number: maskedAccountNumber,
        bank_ifsc: bankDetails.ifsc,
        bank_beneficiary_name: bankDetails.beneficiaryName,
        tnc_accepted: true,
        tnc_accepted_at: new Date().toISOString(),
        products_requested: true,
        products_activated: finalStatus === 'ACTIVATED',
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
      .update({ kyc_status: finalStatus })
      .eq('id', communityId);

    console.log('✅ Embedded KYC flow complete. Status:', finalStatus);

    // Return success (embedded - no onboarding URL)
    return new Response(
      JSON.stringify({ 
        success: true,
        razorpay_account_id: razorpayAccountId,
        kyc_status: finalStatus,
        message: finalStatus === 'ACTIVATED' 
          ? 'KYC approved! Payouts enabled.' 
          : finalStatus === 'PENDING'
          ? 'Your details are under review. You\'ll be notified once verified.'
          : 'KYC submitted. Please check status.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in start-kyc function:', error);
    
    // Try to parse structured error with field info
    let errorObj = { error: 'Failed to start KYC process', field: null };
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error) {
        errorObj = parsed;
      } else {
        errorObj.error = error.message;
      }
    } catch {
      errorObj.error = error.message || String(error);
    }
    
    return new Response(
      JSON.stringify(errorObj),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// Helper function to upload documents to Razorpay with comprehensive error handling
async function uploadDocument(
  accountId: string,
  stakeholderId: string,
  documentType: 'individual_proof_of_identification' | 'individual_proof_of_address',
  documentSubType: 'personal_pan' | 'aadhaar_front' | 'aadhaar_back' | 'voter_id_front' | 'voter_id_back',
  document: { name: string; type: string; data: string },
  auth: string
) {
  // 1) Validate MIME type
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const mimeType = (document.type || '').toLowerCase();
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(JSON.stringify({ 
      error: { 
        description: `Unsupported file type: ${mimeType}. Use JPG/PNG/PDF`, 
        field: 'document' 
      } 
    }));
  }

  // 2) Decode base64 robustly
  let binaryData;
  try {
    const base64Clean = (document.data || '').replace(/\s/g, '');
    binaryData = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
  } catch (err) {
    console.error('Base64 decode error:', err);
    throw new Error(JSON.stringify({ 
      error: { 
        description: 'Corrupt file data. Please re-upload the document.', 
        field: 'document' 
      } 
    }));
  }

  // 3) Size validation - keep it ≤ 2MB for safety
  const blob = new Blob([binaryData], { type: mimeType });
  if (blob.size > 2 * 1024 * 1024) {
    throw new Error(JSON.stringify({ 
      error: { 
        description: 'Document too large. Max size is 2 MB.', 
        field: 'document' 
      } 
    }));
  }

  // 4) Ensure filename has proper extension
  const ensureExtension = (name: string): string => {
    const hasExtension = /\.[a-z0-9]+$/i.test(name || '');
    if (hasExtension) return name;
    
    const extension = mimeType === 'application/pdf' 
      ? 'pdf' 
      : (mimeType === 'image/png' ? 'png' : 'jpg');
    return (name || 'document') + '.' + extension;
  };
  const filename = ensureExtension(document.name);

  // 5) Build FormData with correct structure
  const formData = new FormData();
  formData.append('file', new Blob([blob], { type: mimeType }), filename);
  formData.append('document_type', documentType);
  formData.append(documentSubType, 'true'); // exactly one subtype flag

  // 6) Execute request with retry logic for 5xx errors
  const executeRequest = () => fetch(
    `https://api.razorpay.com/v2/accounts/${accountId}/stakeholders/${stakeholderId}/documents`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`
      },
      body: formData
    }
  );

  let response = await executeRequest();
  
  // Retry once on 5xx errors
  if (!response.ok && response.status >= 500) {
    console.log(`Retrying upload after ${response.status} error...`);
    await new Promise(resolve => setTimeout(resolve, 800));
    response = await executeRequest();
  }

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error(`Document upload failed for ${documentType}:`, responseText);
    
    try {
      const errorJson = JSON.parse(responseText);
      const description = errorJson?.error?.description || responseText;
      const field = errorJson?.error?.field || null;
      
      throw new Error(JSON.stringify({ 
        error: { 
          description, 
          field 
        } 
      }));
    } catch (parseError) {
      throw new Error(responseText || `Document upload failed (${response.status})`);
    }
  }

  console.log(`Document uploaded successfully: ${documentType}`);
  
  try {
    return JSON.parse(responseText);
  } catch {
    return { ok: true };
  }
}
