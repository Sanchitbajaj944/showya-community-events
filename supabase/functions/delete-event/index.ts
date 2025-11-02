import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
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

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { eventId } = await req.json();

    if (!eventId) {
      throw new Error('Event ID is required');
    }

    // Fetch event details
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Check if user is the event creator
    if (event.created_by !== user.id) {
      throw new Error('Only event creator can delete this event');
    }

    // Check if event already ended
    const eventDate = new Date(event.event_date);
    const now = new Date();
    if (eventDate < now) {
      throw new Error('Cannot delete an event that has already ended');
    }

    // Check if event is less than 1 hour away
    const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilEvent < 1) {
      throw new Error('Cannot delete an event that starts in less than 1 hour');
    }

    // Check for bookings
    const { data: participants, error: participantsError } = await supabaseClient
      .from('event_participants')
      .select('*')
      .eq('event_id', eventId);

    if (participantsError) {
      throw new Error('Failed to fetch participants');
    }

    const hasBookings = participants && participants.length > 0;

    if (hasBookings) {
      // Soft delete - mark as cancelled
      const { error: updateError } = await supabaseClient
        .from('events')
        .update({ is_cancelled: true })
        .eq('id', eventId);

      if (updateError) {
        throw new Error('Failed to cancel event');
      }

      // Create notifications for all participants
      const notifications = participants.map(participant => ({
        event_id: eventId,
        user_id: participant.user_id,
        notification_type: 'event_cancelled',
        message: `The event "${event.title}" has been cancelled. ${event.ticket_type === 'paid' ? 'Full refund will be processed.' : ''}`,
        is_read: false
      }));

      const { error: notificationError } = await supabaseClient
        .from('event_notifications')
        .insert(notifications);

      if (notificationError) {
        console.error('Failed to create notifications:', notificationError);
      }

      // If it's a paid event, initiate refunds
      if (event.ticket_type === 'paid') {
        console.log(`Refund processing would be initiated for ${participants.length} participants`);
        // Note: Actual refund processing would be handled by a separate webhook/function
      }

      // Log the cancellation in audit log
      const { error: auditError } = await supabaseClient
        .from('event_audit_log')
        .insert({
          event_id: eventId,
          user_id: user.id,
          action: 'cancelled',
          old_values: { is_cancelled: false },
          new_values: { is_cancelled: true }
        });

      if (auditError) {
        console.error('Failed to log audit:', auditError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          cancelled: true,
          message: `Event cancelled. ${participants.length} participants notified.${event.ticket_type === 'paid' ? ' Refunds will be processed.' : ''}` 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else {
      // Hard delete - no bookings
      const { error: deleteError } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', eventId);

      if (deleteError) {
        throw new Error('Failed to delete event');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted: true,
          message: 'Event deleted successfully' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
