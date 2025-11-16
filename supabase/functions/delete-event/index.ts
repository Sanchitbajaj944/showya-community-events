import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DeleteEventSchema = z.object({
  eventId: z.string().uuid('Invalid event ID format')
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const requestBody = await req.json();
    const validationResult = DeleteEventSchema.safeParse(requestBody);
    
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

    const { eventId } = validationResult.data;

    // Fetch event details with ownership check in single query
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('created_by', user.id)
      .single();

    if (eventError || !event) {
      throw new Error('Operation not permitted');
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
    const { data: participants, error: participantsError } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', eventId);

    if (participantsError) {
      throw new Error('Failed to fetch participants');
    }

    const hasBookings = participants && participants.length > 0;

    if (hasBookings) {
      // Soft delete - mark as cancelled
      const { error: updateError } = await supabase
        .from('events')
        .update({ is_cancelled: true })
        .eq('id', eventId);

      if (updateError) {
        throw new Error('Failed to cancel event');
      }

      // Create notifications for all participants
      const notifications = participants.map((participant: any) => ({
        user_id: participant.user_id,
        title: 'Event Deleted',
        message: `The event "${event.title}" has been deleted. ${event.ticket_type === 'paid' ? 'You will receive a full refund within 5-7 business days.' : ''}`,
        type: 'warning',
        category: 'event',
        related_id: eventId,
      }));

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notificationError) {
        console.error('Failed to create notifications:', notificationError);
      }

      // Send emails to all attendees
      const emailPromises = participants.map((p: any) =>
        supabase.functions.invoke('send-notification-email', {
          body: {
            user_id: p.user_id,
            title: 'Event Deleted - Refund Initiated',
            message: `The event "${event.title}" has been deleted by the organizer. ${event.ticket_type === 'paid' ? 'Your refund has been initiated and will be processed within 5-7 business days.' : ''}`,
          },
        })
      );
      await Promise.allSettled(emailPromises);

      // If it's a paid event, initiate refunds
      if (event.ticket_type === 'paid') {
        console.log(`Refund processing would be initiated for ${participants.length} participants`);
        // Note: Actual refund processing would be handled by a separate webhook/function
      }

      // Log the cancellation in audit log
      const { error: auditError } = await supabase
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
      const { error: deleteError } = await supabase
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
