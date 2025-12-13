import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting payment sync...");

    // Get recent orders from Razorpay (last 24 hours)
    const fromTimestamp = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
    const toTimestamp = Math.floor(Date.now() / 1000);

    const ordersResponse = await fetch(
      `https://api.razorpay.com/v1/orders?from=${fromTimestamp}&to=${toTimestamp}&count=100`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        },
      }
    );

    if (!ordersResponse.ok) {
      throw new Error(`Failed to fetch orders: ${ordersResponse.statusText}`);
    }

    const ordersData = await ordersResponse.json();
    const orders = ordersData.items || [];

    console.log(`Found ${orders.length} orders in last 24 hours`);

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      try {
        // Only process paid orders
        if (order.status !== "paid") {
          skippedCount++;
          continue;
        }

        const orderId = order.id;
        const notes = order.notes || {};
        const eventId = notes.event_id;
        const userId = notes.user_id;
        const role = notes.role || "performer";

        // Skip if no event_id in notes (not an event payment)
        if (!eventId || !userId) {
          skippedCount++;
          continue;
        }

        // Check if booking already exists
        const { data: existingBooking } = await supabase
          .from("event_participants")
          .select("id")
          .eq("razorpay_order_id", orderId)
          .maybeSingle();

        if (existingBooking) {
          skippedCount++;
          continue;
        }

        // Also check by user_id and event_id to avoid duplicates
        const { data: userEventBooking } = await supabase
          .from("event_participants")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", userId)
          .maybeSingle();

        if (userEventBooking) {
          skippedCount++;
          continue;
        }

        // Get payment details for this order
        const paymentsResponse = await fetch(
          `https://api.razorpay.com/v1/orders/${orderId}/payments`,
          {
            headers: {
              Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
            },
          }
        );

        if (!paymentsResponse.ok) {
          console.error(`Failed to fetch payments for order ${orderId}`);
          errorCount++;
          continue;
        }

        const paymentsData = await paymentsResponse.json();
        const capturedPayment = paymentsData.items?.find(
          (p: any) => p.status === "captured"
        );

        if (!capturedPayment) {
          skippedCount++;
          continue;
        }

        // Generate ticket code
        const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Insert missing booking
        const { error: insertError } = await supabase
          .from("event_participants")
          .insert({
            event_id: eventId,
            user_id: userId,
            role: role,
            ticket_code: ticketCode,
            razorpay_payment_id: capturedPayment.id,
            razorpay_order_id: orderId,
            payment_status: "captured",
            amount_paid: capturedPayment.amount / 100, // Convert paise to rupees
          });

        if (insertError) {
          console.error(`Failed to insert booking for order ${orderId}:`, insertError);
          errorCount++;
          continue;
        }

        console.log(`Synced payment ${capturedPayment.id} for order ${orderId}`);
        syncedCount++;

        // Send registration notification
        try {
          await supabase.functions.invoke("handle-event-registration", {
            body: {
              event_id: eventId,
              user_id: userId,
              role: role,
            },
          });
        } catch (notifError) {
          console.error("Failed to send registration notification:", notifError);
        }
      } catch (orderError) {
        console.error(`Error processing order:`, orderError);
        errorCount++;
      }
    }

    const summary = {
      total_orders: orders.length,
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount,
      timestamp: new Date().toISOString(),
    };

    console.log("Payment sync completed:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Payment sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
