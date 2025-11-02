import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Clock, ExternalLink, Ticket } from "lucide-react";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import { BookingModal } from "@/components/BookingModal";

export default function EventDetails() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [userBooking, setUserBooking] = useState<any>(null);
  const [availableSlots, setAvailableSlots] = useState(0);
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchEventDetails();
  }, [eventId, user]);

  const fetchEventDetails = async () => {
    if (!eventId) return;

    try {
      setLoading(true);

      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch community details and KYC status
      if (eventData.community_id) {
        const { data: communityData } = await supabase
          .from("communities")
          .select("*")
          .eq("id", eventData.community_id)
          .single();
        
        setCommunity(communityData);

        // Fetch KYC status for paid events
        if (eventData.ticket_type === 'paid') {
          const { data: razorpayData } = await supabase
            .from("razorpay_accounts")
            .select("kyc_status")
            .eq("community_id", eventData.community_id)
            .maybeSingle();
          
          setKycStatus(razorpayData?.kyc_status || null);
        }
      }

      // Fetch user's booking if logged in
      if (user) {
        const { data: bookingData } = await supabase
          .from("event_participants")
          .select("*")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();

        setUserBooking(bookingData);
      }

      // Calculate available slots
      const { data: participants } = await supabase
        .from("event_participants")
        .select("id")
        .eq("event_id", eventId);

      const totalSlots = eventData.performer_slots + (eventData.audience_enabled ? eventData.audience_slots : 0);
      const bookedSlots = participants?.length || 0;
      setAvailableSlots(totalSlots - bookedSlots);

    } catch (error: any) {
      console.error("Error fetching event:", error);
      toast.error("Failed to load event details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground">Loading event...</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <p className="text-lg">Event not found</p>
            <Button onClick={() => navigate("/events")}>Browse Events</Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const isEventPast = isPast(new Date(event.event_date));
  const isSlotsFull = availableSlots <= 0;
  const canBook = !isEventPast && !isSlotsFull && !userBooking;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Event Banner */}
        {event.poster_url && (
          <div className="aspect-[21/9] rounded-2xl overflow-hidden mb-8 shadow-lg">
            <img 
              src={event.poster_url} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Event Header */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{event.category || 'Event'}</Badge>
                {isEventPast && <Badge variant="outline">Past Event</Badge>}
                {isSlotsFull && !isEventPast && <Badge variant="destructive">Sold Out</Badge>}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">{event.title}</h1>
              
              {/* Community Link */}
              {community && (
                <Link 
                  to={`/community/${community.id}/public`}
                  className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Hosted by {community.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>

            {/* Booking Status / Button */}
            <div className="shrink-0">
              {userBooking ? (
                <div className="text-right">
                  <Badge className="mb-2">You're Booked</Badge>
                  <p className="text-sm text-muted-foreground">Ticket: {userBooking.ticket_code}</p>
                </div>
              ) : event.ticket_type === 'paid' ? (
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">₹{event.performer_ticket_price}</p>
                  <p className="text-sm text-muted-foreground">per ticket</p>
                </div>
              ) : (
                <Badge variant="secondary" className="text-lg px-4 py-2">Free Event</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Event Details Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Date & Time */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Date & Time</p>
                  <p className="text-muted-foreground">
                    {format(new Date(event.event_date), "EEEE, MMMM dd, yyyy")}
                  </p>
                  <p className="text-muted-foreground">
                    {format(new Date(event.event_date), "h:mm a")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Duration */}
          {event.duration && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Duration</p>
                    <p className="text-muted-foreground">{event.duration} minutes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          {event.location && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold mb-1">Location</p>
                    <p className="text-muted-foreground break-words">{event.location}</p>
                    {event.city && <p className="text-sm text-muted-foreground">{event.city}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Meeting URL */}
          {event.meeting_url && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <ExternalLink className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold mb-1">Online Event</p>
                    <a 
                      href={event.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm truncate block"
                    >
                      Join Meeting
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Capacity */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Capacity</p>
                  <p className="text-muted-foreground">
                    {event.performer_slots} performer{event.performer_slots > 1 ? 's' : ''}
                  </p>
                  {event.audience_enabled && (
                    <p className="text-muted-foreground">
                      {event.audience_slots} audience seats
                    </p>
                  )}
                  <p className="text-sm text-primary font-semibold mt-1">
                    {availableSlots} slots available
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Info */}
          {event.ticket_type === 'paid' && event.audience_enabled && event.audience_ticket_price && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Ticket className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Ticket Pricing</p>
                    <p className="text-muted-foreground">Performer: ₹{event.performer_ticket_price}</p>
                    <p className="text-muted-foreground">Audience: ₹{event.audience_ticket_price}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">About This Event</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Refund Policy */}
        {event.ticket_type === 'paid' && (
          <Card className="mb-8 border-muted">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">Cancellation & Refund Policy</h3>
              <p className="text-sm text-muted-foreground">
                Cancellations made 48 hours before the event are eligible for a full refund. 
                Cancellations within 48 hours will receive a 50% refund. No refunds for cancellations 
                within 24 hours of the event.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Booking CTA */}
        <div className="sticky bottom-4 md:static md:bottom-auto">
          {userBooking ? (
            <Card className="bg-primary/10 border-primary">
              <CardContent className="p-6 text-center">
                <p className="font-semibold mb-2">You're all set! 🎉</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Your booking confirmation has been sent to your email
                </p>
                <Button variant="outline" onClick={() => navigate("/profile")}>
                  View My Bookings
                </Button>
              </CardContent>
            </Card>
          ) : isEventPast ? (
            <Card className="border-muted">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">This event has ended</p>
              </CardContent>
            </Card>
          ) : isSlotsFull ? (
            <Card className="border-destructive">
              <CardContent className="p-6 text-center">
                <p className="font-semibold text-destructive mb-2">Event Sold Out</p>
                <p className="text-sm text-muted-foreground">All slots have been booked</p>
              </CardContent>
            </Card>
          ) : (
            <Button 
              size="lg" 
              className="w-full shadow-lg"
              onClick={() => {
                if (!user) {
                  toast.error("Please sign in to book a slot");
                  navigate("/auth/signin");
                  return;
                }
                setBookingModalOpen(true);
              }}
            >
              {event.ticket_type === 'paid' ? (
                <>Book Now • ₹{event.performer_ticket_price}</>
              ) : (
                <>Book Free Slot</>
              )}
            </Button>
          )}
        </div>
      </div>

      <BottomNav />

      {/* Booking Modal */}
      {user && (
        <BookingModal 
          open={bookingModalOpen}
          onOpenChange={setBookingModalOpen}
          event={event}
          availableSlots={availableSlots}
          onBookingComplete={fetchEventDetails}
          kycStatus={kycStatus}
        />
      )}
    </div>
  );
}
