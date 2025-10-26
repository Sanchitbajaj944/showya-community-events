import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { communityId, updateType, data } = await req.json();

    // Get community and verify ownership
    const { data: community, error: communityError } = await supabaseClient
      .from('communities')
      .select('*, razorpay_accounts(*)')
      .eq('id', communityId)
      .eq('owner_id', user.id)
      .single();

    if (communityError || !community) {
      throw new Error('Community not found or access denied');
    }

    const razorpayAccount = community.razorpay_accounts?.[0];
    if (!razorpayAccount?.razorpay_account_id) {
      throw new Error('No Razorpay account found');
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const auth = btoa(`${keyId}:${keySecret}`);

    const accountId = razorpayAccount.razorpay_account_id;
    let updateResult: any;

    // Handle different types of updates
    switch (updateType) {
      case 'address': {
        // Update address on the account
        const response = await fetch(`https://api.razorpay.com/v2/accounts/${accountId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile: {
              addresses: {
                registered: {
                  street1: data.street1,
                  street2: data.street2 || '',
                  city: data.city,
                  state: data.state,
                  postal_code: data.postal_code,
                  country: 'IN'
                }
              }
            }
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to update address: ${JSON.stringify(error)}`);
        }
        updateResult = await response.json();
        break;
      }

      case 'stakeholder': {
        // Update stakeholder details (PAN, DOB, name)
        if (!razorpayAccount.stakeholder_id) {
          throw new Error('No stakeholder found');
        }

        const stakeholderBody: any = {};
        if (data.pan) stakeholderBody.pan = data.pan;
        if (data.name) stakeholderBody.name = data.name;
        if (data.dob) stakeholderBody.kyc = { pan: data.pan };
        if (data.addresses) stakeholderBody.addresses = data.addresses;

        const response = await fetch(
          `https://api.razorpay.com/v2/accounts/${accountId}/stakeholders/${razorpayAccount.stakeholder_id}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(stakeholderBody)
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to update stakeholder: ${JSON.stringify(error)}`);
        }
        updateResult = await response.json();
        break;
      }

      case 'bank': {
        // Update bank details on the product
        if (!razorpayAccount.product_id) {
          throw new Error('No product found');
        }

        const response = await fetch(
          `https://api.razorpay.com/v2/accounts/${accountId}/products/${razorpayAccount.product_id}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              settlements: {
                account_number: data.account_number,
                ifsc_code: data.ifsc,
                beneficiary_name: data.beneficiary_name
              },
              tnc_accepted: true
            })
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to update bank details: ${JSON.stringify(error)}`);
        }
        updateResult = await response.json();

        // Update our database
        await supabaseClient
          .from('razorpay_accounts')
          .update({
            bank_account_number: data.account_number,
            bank_ifsc: data.ifsc,
            bank_beneficiary_name: data.beneficiary_name,
            last_updated: new Date().toISOString()
          })
          .eq('id', razorpayAccount.id);
        break;
      }

      case 'documents': {
        // Upload documents
        if (!razorpayAccount.stakeholder_id) {
          throw new Error('No stakeholder found');
        }

        const uploadResults = [];
        
        // Upload PAN if provided
        if (data.panCard) {
          const panResponse = await fetch(
            `https://api.razorpay.com/v2/accounts/${accountId}/stakeholders/${razorpayAccount.stakeholder_id}/documents`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                document_type: 'individual_proof_of_identification',
                file: data.panCard.base64,
                file_name: data.panCard.name
              })
            }
          );
          
          if (!panResponse.ok) {
            const error = await panResponse.json();
            console.error('PAN upload failed:', error);
          } else {
            uploadResults.push({ type: 'pan', result: await panResponse.json() });
          }
        }

        // Upload address proof if provided
        if (data.addressProof) {
          const addressResponse = await fetch(
            `https://api.razorpay.com/v2/accounts/${accountId}/stakeholders/${razorpayAccount.stakeholder_id}/documents`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                document_type: 'individual_proof_of_address',
                file: data.addressProof.base64,
                file_name: data.addressProof.name
              })
            }
          );
          
          if (!addressResponse.ok) {
            const error = await addressResponse.json();
            console.error('Address proof upload failed:', error);
          } else {
            uploadResults.push({ type: 'address', result: await addressResponse.json() });
          }
        }

        updateResult = { documents: uploadResults };
        break;
      }

      default:
        throw new Error(`Unknown update type: ${updateType}`);
    }

    // Request products with T&C acceptance to trigger review
    try {
      const productResponse = await fetch(
        `https://api.razorpay.com/v2/accounts/${accountId}/products`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            product_name: 'route',
            tnc_accepted: true
          })
        }
      );

      if (!productResponse.ok) {
        const error = await productResponse.json();
        console.log('Product request response:', error);
        // Continue even if product already exists
      } else {
        const productData = await productResponse.json();
        console.log('Product requested successfully:', productData);
      }
    } catch (productError) {
      console.log('Product request error:', productError);
      // Continue even if product request fails - the account update is what matters
    }

    // Update KYC status to pending review
    await supabaseClient
      .from('razorpay_accounts')
      .update({
        kyc_status: 'PENDING',
        last_updated: new Date().toISOString()
      })
      .eq('id', razorpayAccount.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'KYC data updated successfully',
        result: updateResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-kyc:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
