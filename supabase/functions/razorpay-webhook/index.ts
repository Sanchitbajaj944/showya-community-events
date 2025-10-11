import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
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

    const signature = req.headers.get('x-razorpay-signature');
    const body = await req.text();
    
    // Verify webhook signature
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (webhookSecret && signature) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(body)
      );
      
      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }
    }

    const event = JSON.parse(body);
    console.log('Webhook event received:', event.event);

    // Handle account KYC status updates
    if (event.event === 'account.activated' || 
        event.event === 'account.suspended' ||
        event.event === 'account.rejected' ||
        event.event === 'account.kyc.pending_verification' ||
        event.event === 'account.requirements.needs_attention' ||
        event.event === 'account.verified') {
      
      const accountId = event.payload.account.entity.id;
      let kycStatus = 'IN_PROGRESS';
      let errorReason = null;

      // Map Razorpay events to KYC statuses
      if (event.event === 'account.kyc.pending_verification') {
        kycStatus = 'IN_PROGRESS';
      } else if (event.event === 'account.requirements.needs_attention') {
        kycStatus = 'NEEDS_INFO';
        errorReason = event.payload.account.entity.error_reason || 'Additional information required';
      } else if (event.event === 'account.rejected') {
        kycStatus = 'REJECTED';
        errorReason = event.payload.account.entity.error_reason || 'KYC verification rejected';
      } else if (event.event === 'account.verified') {
        kycStatus = 'VERIFIED';
      } else if (event.event === 'account.activated') {
        kycStatus = 'ACTIVATED';
      }

      // Extract bank details if available
      const bankMasked = event.payload.account.entity.bank_account?.ifsc_code 
        ? `${event.payload.account.entity.bank_account.ifsc_code.substring(0, 4)}****`
        : null;

      // Update razorpay_accounts table
      const { error } = await supabaseClient
        .from('razorpay_accounts')
        .update({ 
          kyc_status: kycStatus,
          error_reason: errorReason,
          bank_masked: bankMasked,
          last_updated: new Date().toISOString()
        })
        .eq('razorpay_account_id', accountId);

      if (error) {
        console.error('Error updating KYC status:', error);
        throw error;
      }

      console.log(`KYC status updated to ${kycStatus} for account ${accountId}`);
    }

    // Handle payment events for paid event tickets
    if (event.event === 'payment.captured') {
      const paymentId = event.payload.payment.entity.id;
      const notes = event.payload.payment.entity.notes;
      
      if (notes?.event_id && notes?.user_id) {
        // Create event participant entry with ticket code
        await supabaseClient
          .from('event_participants')
          .insert({
            event_id: notes.event_id,
            user_id: notes.user_id,
            role: 'attendee',
            ticket_code: paymentId.substring(0, 10).toUpperCase()
          });

        console.log(`Ticket created for event ${notes.event_id}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
