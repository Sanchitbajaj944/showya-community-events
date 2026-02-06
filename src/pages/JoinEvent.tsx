import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { JaasMeeting } from "@/components/JaasMeeting";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  Ticket,
  Video,
} from "lucide-react";
import { format } from "date-fns";
import { MetaEvents } from "@/lib/metaConversions";

type JoinContext = {
  event: {
    id: string;
    title: string;
    description: string;
    event_date: string;
    poster_url: string;
    ticket_type: string;
    performer_slots: number;
    performer_ticket_price: number;
    audience_enabled: boolean;
    audience_slots: number;
    audience_ticket_price: number;
    community_name: string;
    community_id: string;
    is_cancelled: boolean;
    allow_paid_audience_mic: boolean;
    allow_free_audience_mic: boolean;
    duration: number;
  };
  audienceRemaining: number;
  performerRemaining: number;
  booking: {
    id: string;
    role: string;
    payment_status: string;
    amount_paid: number;
    mic_permission: string;
    ticket_code: string;
  } | null;
  isHost: boolean;
};

// Load Razorpay script dynamically
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function JoinEvent() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [context, setContext] = useState<JoinContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [autoBooked, setAutoBooked] = useState(false);

  const fetchContext = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-join-context', {
        body: { eventId },
      });

      if (error) throw error;
      setContext(data);
    } catch (err: any) {
      console.error('Failed to fetch join context:', err);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContext();
  }, [eventId]);

  // Auto-book for free audience
  useEffect(() => {
    if (!context || autoBooked || context.booking || context.isHost) return;

    const isFreeAudience = context.event.audience_enabled && context.event.audience_ticket_price === 0;

    if (isFreeAudience && context.audienceRemaining > 0) {
      handleFreeAudienceBooking();
    }
  }, [context, autoBooked]);

  const handleFreeAudienceBooking = async () => {
    if (!user || !eventId) return;
    setAutoBooked(true);
    setActionLoading(true);

    try {
      const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const { error } = await supabase.from('event_participants').insert({
        event_id: eventId,
        user_id: user.id,
        role: 'audience' as any,
        ticket_code: ticketCode,
        payment_status: 'free',
        amount_paid: 0,
        mic_permission: 'none',
      });

      if (error) throw error;

      // Send registration notification
      await supabase.functions.invoke('handle-event-registration', {
        body: { event_id: eventId, user_id: user.id, role: 'audience' },
      });

      if (user.id) {
        MetaEvents.eventRegistration(user.id, eventId, context?.event.title || '', 'audience', user.email);
      }

      toast.success('Joined as audience! 🎧');
      await fetchContext();
    } catch (err: any) {
      console.error('Free booking error:', err);
      toast.error('Failed to join. Spots may be full.');
      setAutoBooked(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaidAudienceBooking = async () => {
    if (!user || !eventId || !context) return;
    setActionLoading(true);

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error('Failed to load payment gateway');
        setActionLoading(false);
        return;
      }

      const price = context.event.audience_ticket_price;

      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-payment-order',
        { body: { event_id: eventId, amount: price } }
      );

      if (orderError) throw orderError;

      setActionLoading(false);

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.order_id,
        name: context.event.title,
        description: 'Audience Ticket',
        handler: async function (response: any) {
          try {
            toast.loading('Confirming booking...', { id: 'booking-confirm' });

            // Re-check availability
            const { data: recheckData } = await supabase.functions.invoke('get-join-context', {
              body: { eventId },
            });

            if (recheckData && recheckData.audienceRemaining <= 0 && !recheckData.booking) {
              toast.dismiss('booking-confirm');
              toast.error('Sorry, audience is now full. A refund will be initiated.');
              // TODO: Trigger refund
              return;
            }

            const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            const { error: bookingError } = await supabase.from('event_participants').insert({
              event_id: eventId,
              user_id: user.id,
              role: 'audience' as any,
              ticket_code: ticketCode,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              payment_status: 'captured',
              amount_paid: price,
              mic_permission: 'none',
            });

            if (bookingError) throw bookingError;

            await supabase.functions.invoke('handle-event-registration', {
              body: { event_id: eventId, user_id: user.id, role: 'audience' },
            });

            if (user.id) {
              MetaEvents.purchase(user.id, eventId, price, context.event.title, user.email);
            }

            toast.dismiss('booking-confirm');
            toast.success('Ticket purchased! 🎉');
            await fetchContext();
          } catch (err: any) {
            toast.dismiss('booking-confirm');
            toast.error('Payment received but booking failed. Contact support.');
          }
        },
        prefill: { email: user.email },
        theme: { color: '#8B5CF6' },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
      razorpay.on('payment.failed', () => {
        toast.error('Payment failed. Please try again.');
      });
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Event not found</h2>
          <Button variant="outline" onClick={() => navigate('/events')}>
            Browse Events
          </Button>
        </div>
      </div>
    );
  }

  const { event, audienceRemaining, performerRemaining, booking, isHost } = context;

  if (showMeeting) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-4 max-w-5xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMeeting(false)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Join Page
          </Button>
          <JaasMeeting
            eventId={eventId!}
            eventTitle={event.title}
            onClose={() => setShowMeeting(false)}
          />
        </div>
      </div>
    );
  }

  const isFreeAudience = event.audience_ticket_price === 0;
  const isPaidAudience = event.audience_ticket_price > 0;
  const audienceSoldOut = audienceRemaining <= 0;

  // Determine user role
  let userRole: string | null = null;
  if (isHost) userRole = 'host';
  else if (booking) userRole = booking.role;

  // Mic policy label
  const getMicLabel = () => {
    if (isHost || booking?.role === 'performer') return null;
    if (booking?.role === 'audience') {
      if (booking.payment_status === 'captured' && event.allow_paid_audience_mic) {
        return { icon: <Mic className="h-4 w-4" />, text: 'Can request mic', variant: 'default' as const };
      }
      return { icon: <MicOff className="h-4 w-4" />, text: 'Listen-only', variant: 'secondary' as const };
    }
    return null;
  };

  const micLabel = getMicLabel();

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/events/${eventId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Event
        </Button>

        {/* Event Info Card */}
        <Card className="overflow-hidden mb-6">
          {event.poster_url && (
            <div className="w-full aspect-[16/9] overflow-hidden">
              <img
                src={event.poster_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <CardContent className="p-4 space-y-3">
            <h1 className="text-xl font-bold">{event.title}</h1>
            <p className="text-sm text-muted-foreground">{event.community_name}</p>

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(event.event_date), 'PPp')}
              </div>
              {event.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {event.duration} min
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {event.audience_enabled && (
                <Badge variant={audienceSoldOut ? 'destructive' : 'secondary'}>
                  <Users className="h-3 w-3 mr-1" />
                  {audienceSoldOut ? 'Audience Full' : `${audienceRemaining} audience spots`}
                </Badge>
              )}
              {performerRemaining > 0 && (
                <Badge variant="outline">
                  {performerRemaining} performer spots
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cancelled Event */}
        {event.is_cancelled && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Event Cancelled</AlertTitle>
            <AlertDescription>This event has been cancelled by the host.</AlertDescription>
          </Alert>
        )}

        {/* Join Action Card */}
        {!event.is_cancelled && (
          <Card className="mb-6">
            <CardContent className="p-6 space-y-4">
              {/* Host */}
              {isHost && (
                <div className="text-center space-y-3">
                  <Badge className="bg-primary text-primary-foreground">Host</Badge>
                  <p className="text-sm text-muted-foreground">You are the host of this event</p>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => setShowMeeting(true)}
                  >
                    <Video className="h-5 w-5 mr-2" />
                    Join as Host
                  </Button>
                </div>
              )}

              {/* Already Booked */}
              {!isHost && booking && (
                <div className="text-center space-y-3">
                  <Badge variant="secondary" className="capitalize">{booking.role}</Badge>
                  {micLabel && (
                    <Badge variant={micLabel.variant} className="ml-2">
                      {micLabel.icon}
                      <span className="ml-1">{micLabel.text}</span>
                    </Badge>
                  )}
                  <p className="text-sm text-muted-foreground">
                    You have a {booking.role} ticket for this event
                  </p>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => setShowMeeting(true)}
                  >
                    <Video className="h-5 w-5 mr-2" />
                    Join Meeting
                  </Button>
                </div>
              )}

              {/* No Booking Yet */}
              {!isHost && !booking && (
                <div className="space-y-4">
                  {/* Auto-booking in progress for free audience */}
                  {actionLoading && (
                    <div className="text-center py-4">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Joining event...</p>
                    </div>
                  )}

                  {/* Free audience - auto-book in progress or sold out */}
                  {!actionLoading && isFreeAudience && audienceSoldOut && (
                    <div className="text-center py-4">
                      <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="font-semibold text-lg">Audience Full</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        All {event.audience_slots} audience spots have been taken
                      </p>
                    </div>
                  )}

                  {/* Paid audience */}
                  {!actionLoading && isPaidAudience && !audienceSoldOut && (
                    <div className="text-center space-y-3">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Audience Ticket</p>
                        <p className="text-2xl font-bold">₹{event.audience_ticket_price}</p>
                        {event.allow_paid_audience_mic && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                            <Mic className="h-3 w-3" />
                            Can request mic during event
                          </p>
                        )}
                      </div>
                      <Button
                        size="lg"
                        className="w-full"
                        onClick={handlePaidAudienceBooking}
                        disabled={actionLoading}
                      >
                        <Ticket className="h-5 w-5 mr-2" />
                        Buy Ticket & Join
                      </Button>
                    </div>
                  )}

                  {/* Paid audience - sold out */}
                  {!actionLoading && isPaidAudience && audienceSoldOut && (
                    <div className="text-center py-4">
                      <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="font-semibold text-lg">Audience Full</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        All audience spots have been taken
                      </p>
                    </div>
                  )}

                  {/* Performer option */}
                  {performerRemaining > 0 && !actionLoading && (
                    <div className="border-t pt-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Want to perform instead?
                      </p>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate(`/events/${eventId}`)}
                      >
                        Book as Performer (₹{event.performer_ticket_price})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
