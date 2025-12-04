import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Error sanitization
function sanitizeError(error: any, logId: string): string {
  console.error(`[${logId}]`, error);
  
  if (error.message?.includes('Unauthorized')) {
    return `Authentication required. (Ref: ${logId.slice(0, 8)})`;
  }
  if (error.message?.includes('No community found')) {
    return `No community found. (Ref: ${logId.slice(0, 8)})`;
  }
  if (error.message?.includes('Razorpay API')) {
    return `Service temporarily unavailable. (Ref: ${logId.slice(0, 8)})`;
  }
  return `An error occurred. Please try again. (Ref: ${logId.slice(0, 8)})`;
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

    // Fetch latest status from Razorpay with environment-appropriate credentials
    const { keyId: razorpayKeyId, keySecret: razorpayKeySecret } = getRazorpayCredentials(req);
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    
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
      
      // Check if it's an access denied error - account may be from different environment
      if (errorText.includes('Access Denied') || response.status === 400) {
        console.log('Access denied - account may have been created with different credentials (test vs live)');
        
        // Return a helpful response instead of throwing an error
        return new Response(
          JSON.stringify({ 
            kyc_status: 'NOT_STARTED',
            message: 'This KYC account was created in a different environment. Please restart the KYC process.',
            needs_restart: true,
            account_mismatch: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Razorpay API error');
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
          
          // Check if bank is configured - if activated and no settlement requirements pending
          const hasPendingSettlements = missingFields.some((field: string) => 
            field.startsWith('settlements.')
          );
          bankConfigured = productData.activation_status === 'activated' && !hasPendingSettlements;
          console.log('Bank configured:', bankConfigured, '(status:', productData.activation_status, ', pending settlements:', hasPendingSettlements, ')');
          
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
      newStatus = 'ACTIVATED';
    } else if (accountData.status === 'rejected' || accountData.status === 'suspended') {
      newStatus = 'REJECTED';
    } else if (accountData.status === 'needs_clarification' || missingFields.length > 0) {
      newStatus = 'NEEDS_INFO';
    } else if (accountData.status === 'under_review') {
      newStatus = 'IN_PROGRESS'; // Changed from 'PENDING' to 'IN_PROGRESS'
    }

    // Update status if changed
    console.log('Current DB status:', razorpayAccount.kyc_status, '| New calculated status:', newStatus);
    if (newStatus !== razorpayAccount.kyc_status) {
      console.log('Status changed! Updating database...');
      
      // Update razorpay_accounts table (trigger will sync to communities)
      const { error: razorpayUpdateError } = await supabaseClient
        .from('razorpay_accounts')
        .update({ 
          kyc_status: newStatus,
          last_updated: new Date().toISOString()
        })
        .eq('id', razorpayAccount.id);
      
      if (razorpayUpdateError) {
        console.error('❌ Error updating razorpay_accounts:', razorpayUpdateError);
        throw new Error('Failed to update KYC status');
      } else {
        console.log('✓ Updated razorpay_accounts table - trigger will sync to communities');
      }
    } else {
      console.log('No status change detected, skipping database update');
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
    const logId = crypto.randomUUID();
    const userMessage = sanitizeError(error, logId);
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
