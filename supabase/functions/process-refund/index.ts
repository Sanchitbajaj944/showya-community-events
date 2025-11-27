import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ProcessRefundSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().optional()
});

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

    const requestBody = await req.json();
    const validationResult = ProcessRefundSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { bookingId, reason } = validationResult.data;

    console.log('Processing refund for booking:', bookingId);

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('event_participants')
      .select('*, events!inner(*)')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found:', bookingError);
      throw new Error('Booking not found or unauthorized');
    }

    const event = booking.events;

    // Handle free booking cancellation (no payment to refund)
    if (!booking.razorpay_payment_id) {
      console.log('Processing free booking cancellation');
      
      // Delete the booking
      const { error: deleteError } = await supabaseClient
        .from('event_participants')
        .delete()
        .eq('id', bookingId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting booking:', deleteError);
        throw new Error('Failed to cancel booking');
      }

      // Create notification
      await supabaseClient
        .from('notifications')
        .insert({
          user_id: user.id,
          title: 'Booking Cancelled',
          message: `Your booking for "${event.title}" has been cancelled successfully.`,
          type: 'info',
          category: 'event',
          related_id: event.id,
          action_url: `/events/${event.id}`
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Booking cancelled successfully.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle paid booking refund
    console.log('Processing paid booking refund');

    // Check if refund already exists
    const { data: existingRefund } = await supabaseClient
      .from('refunds')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (existingRefund) {
      return new Response(
        JSON.stringify({ 
          error: 'Refund already initiated',
          refund: existingRefund
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate refund percentage based on time until event
    const hoursUntilEvent = (new Date(event.event_date).getTime() - Date.now()) / (1000 * 60 * 60);
    
    let refundPercentage = 0;
    if (hoursUntilEvent >= 24) {
      refundPercentage = 100; // Full refund
    } else if (hoursUntilEvent >= 2) {
      refundPercentage = 75; // 75% refund
    } else {
      refundPercentage = 0; // No refund
    }

    if (refundPercentage === 0) {
      throw new Error('Refund not available. Event is less than 2 hours away.');
    }

    // Calculate refund amount
    const ticketPrice = booking.role === 'performer' 
      ? event.performer_ticket_price 
      : event.audience_ticket_price || 0;
    
    const refundAmount = (ticketPrice * refundPercentage) / 100;

    console.log(`Refund calculation: ${refundPercentage}% of ₹${ticketPrice} = ₹${refundAmount}`);

    // Create refund record
    const { data: refundRecord, error: refundInsertError } = await supabaseClient
      .from('refunds')
      .insert({
        event_id: event.id,
        user_id: user.id,
        booking_id: bookingId,
        razorpay_payment_id: booking.razorpay_payment_id,
        amount: refundAmount,
        refund_percentage: refundPercentage,
        status: 'processing',
        reason: reason || `Booking cancelled ${hoursUntilEvent.toFixed(1)} hours before event`
      })
      .select()
      .single();

    if (refundInsertError) {
      console.error('Error creating refund record:', refundInsertError);
      throw refundInsertError;
    }

    // Process refund through Razorpay
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    
    // Convert to paise (Razorpay uses smallest currency unit)
    const amountInPaise = Math.round(refundAmount * 100);

    console.log('Initiating Razorpay refund:', {
      payment_id: booking.razorpay_payment_id,
      amount: amountInPaise
    });

    // For Route Transfer payments, we need to reverse the transfer first
    // Using reverse_all to automatically reverse transfers before refunding
    const razorpayResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${booking.razorpay_payment_id}/refund`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          speed: 'normal',
          reverse_all: 1, // This reverses all transfers associated with the payment before processing refund
          notes: {
            refund_id: refundRecord.id,
            event_id: event.id,
            user_id: user.id,
            reason: reason || 'Booking cancelled'
          }
        })
      }
    );

    const razorpayData = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error('Razorpay refund failed:', razorpayData);
      
      // Update refund record with error
      await supabaseClient
        .from('refunds')
        .update({
          status: 'failed',
          error_message: razorpayData.error?.description || 'Refund failed'
        })
        .eq('id', refundRecord.id);

      throw new Error(razorpayData.error?.description || 'Failed to process refund with Razorpay');
    }

    console.log('Razorpay refund initiated:', razorpayData);

    // Update refund record with Razorpay refund ID
    const { error: updateError } = await supabaseClient
      .from('refunds')
      .update({
        razorpay_refund_id: razorpayData.id,
        status: 'processing',
        processed_at: new Date().toISOString()
      })
      .eq('id', refundRecord.id);

    if (updateError) {
      console.error('Error updating refund record:', updateError);
    }

    // Create notification for refund initiation
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: user.id,
        title: 'Refund Initiated',
        message: `Your refund of ₹${refundAmount} (${refundPercentage}%) for "${event.title}" has been initiated. It will be processed within 5-7 business days.`,
        type: 'success',
        category: 'payment',
        related_id: refundRecord.id,
        action_url: `/events/${event.id}`
      });

    // Send email notification
    await supabaseClient.functions.invoke('send-notification-email', {
      body: {
        user_id: user.id,
        title: 'Refund Initiated',
        message: `Your refund of ₹${refundAmount} (${refundPercentage}%) for "${event.title}" has been initiated. It will be processed within 5-7 business days.`,
        action_url: `${Deno.env.get('SUPABASE_URL')?.replace('//', '//app.')}/events/${event.id}`
      }
    });

    // Delete the booking after successful refund initiation
    const { error: deleteError } = await supabaseClient
      .from('event_participants')
      .delete()
      .eq('id', bookingId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting booking:', deleteError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund: {
          id: refundRecord.id,
          amount: refundAmount,
          percentage: refundPercentage,
          razorpay_refund_id: razorpayData.id,
          status: 'processing'
        },
        message: `Refund of ₹${refundAmount} (${refundPercentage}%) initiated successfully. It will be processed within 5-7 business days.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-refund:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred processing refund'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
