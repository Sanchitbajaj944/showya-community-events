import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Clock, ExternalLink, Ticket, LayoutDashboard, Share2, Flag, ChevronDown, Video } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, isPast, differenceInHours } from "date-fns";
import { toast } from "sonner";
import { BookingModal } from "@/components/BookingModal";
import { ShareDialog } from "@/components/ShareDialog";
import { ReportDialog } from "@/components/ReportDialog";
import { CollapsibleDescription } from "@/components/CollapsibleDescription";
import { JaasMeeting } from "@/components/JaasMeeting";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Helper to extract URL from meeting_url text
const extractUrl = (text: string): string | null => {
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);
  return match ? match[1] : null;
};

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
  const [performerCount, setPerformerCount] = useState(0);
  const [audienceCount, setAudienceCount] = useState(0);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundPercentage, setRefundPercentage] = useState(0);
  const [refundBaseAmount, setRefundBaseAmount] = useState(0);
  const [showBookingDrawer, setShowBookingDrawer] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [spotlight, setSpotlight] = useState<any>(null);
  const [performers, setPerformers] = useState<any[]>([]);
  const [performersOpen, setPerformersOpen] = useState(true);
  const [showJaasMeeting, setShowJaasMeeting] = useState(false);

  useEffect(() => {
    fetchEventDetails();
  }, [eventId, user?.id]);

  // Real-time subscription for slot updates
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`event-${eventId}-participants`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_participants',
          filter: `event_id=eq.${eventId}`
        },
        () => {
          // Recalculate available slots when participants change
          fetchParticipantCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, event]);

  const fetchParticipantCount = async () => {
    if (!eventId || !event) return;

    const { data: countsData } = await supabase
      .rpc("get_event_participant_counts", {
        _event_id: eventId
      })
      .single();

    const pCount = countsData?.performer_count || 0;
    const aCount = countsData?.audience_count || 0;
    
    setPerformerCount(pCount);
    setAudienceCount(aCount);
    
    const performerAvailable = Math.max(0, event.performer_slots - pCount);
    const audienceAvailable = event.audience_enabled && event.audience_slots > 0 
      ? Math.max(0, event.audience_slots - aCount) 
      : 0;
    
    const totalAvailable = performerAvailable + audienceAvailable;
    setAvailableSlots(totalAvailable);

    // Also refresh performer profiles
    const { data: performersData } = await supabase
      .rpc("get_event_participants_with_profiles", {
        _event_id: eventId,
        _role: 'performer'
      });
    
    setPerformers(performersData || []);
  };

  const fetchEventDetails = async () => {
    if (!eventId) return;

    try {
      setLoading(true);

      // Fetch user's booking first if logged in
      if (user) {
        const { data: bookingData } = await supabase
          .from("event_participants")
          .select("*")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();
        
        setUserBooking(bookingData);
      }

      // Use secure function to get event details (meeting_url only returned if user is registered)
      const { data: eventData, error: eventError } = await supabase
        .rpc("get_event_details", {
          _event_id: eventId,
          _user_id: user?.id || null
        })
        .maybeSingle();

      if (eventError) throw eventError;
      
      if (!eventData) {
        throw new Error("Event not found");
      }

      // Fetch community details and KYC status
      if (eventData.community_id) {
        const { data: communityData } = await supabase
          .from("communities")
          .select("*")
          .eq("id", eventData.community_id)
          .single();
        
        setCommunity(communityData);

        // Use community's KYC status for paid events
        if (eventData.ticket_type === 'paid' && communityData) {
          setKycStatus(communityData.kyc_status);
        }
      }

      // Calculate available slots by role using secure function that bypasses RLS
      const { data: countsData, error: countsError } = await supabase
        .rpc("get_event_participant_counts", {
          _event_id: eventId
        })
        .single();

      if (countsError) {
        console.error("Error fetching participant counts:", countsError);
      }

      const pCount = countsData?.performer_count || 0;
      const aCount = countsData?.audience_count || 0;
      
      setPerformerCount(pCount);
      setAudienceCount(aCount);
      
      const performerAvailable = Math.max(0, eventData.performer_slots - pCount);
      const audienceAvailable = eventData.audience_enabled && eventData.audience_slots > 0 
        ? Math.max(0, eventData.audience_slots - aCount) 
        : 0;
      
      const totalAvailable = performerAvailable + audienceAvailable;
      setAvailableSlots(totalAvailable);
      
      // Set event data AFTER calculations to ensure counts are ready
      setEvent(eventData);

      // Fetch performer profiles for social proof
      const { data: performersData } = await supabase
        .rpc("get_event_participants_with_profiles", {
          _event_id: eventId,
          _role: 'performer'
        });
      
      setPerformers(performersData || []);

      // Fetch spotlight video if event has passed
      const { data: spotlightData } = await supabase
        .from("spotlights")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();
      
      setSpotlight(spotlightData);

    } catch (error: any) {
      console.error("Error fetching event:", error);
      toast.error("Failed to load event details");
    } finally {
      setLoading(false);
    }
  };

  const calculateRefund = () => {
    if (!event || !userBooking) return;

    const hoursUntilEvent = differenceInHours(new Date(event.event_date), new Date());
    
    // Use actual amount paid (after promo discounts), fallback to ticket price for legacy bookings
    const ticketPrice = userBooking.role === 'performer' 
      ? event.performer_ticket_price 
      : (event.audience_ticket_price || 0);
    const amountPaid = (userBooking.amount_paid && userBooking.amount_paid > 0) 
      ? userBooking.amount_paid 
      : ticketPrice;
    
    let percentage = 0;
    if (hoursUntilEvent >= 24) {
      percentage = 100; // Full refund - 24+ hours before
    } else if (hoursUntilEvent >= 2) {
      percentage = 75; // 75% refund - 2-24 hours before
    } else {
      percentage = 0; // No refund - less than 2 hours before
    }
    
    setRefundPercentage(percentage);
    setRefundBaseAmount(amountPaid);
    setRefundAmount((amountPaid * percentage) / 100);
  };

  const handleCancelBooking = async () => {
    if (!userBooking || !user) return;

    try {
      // Call the refund edge function
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: {
          bookingId: userBooking.id,
          reason: 'User cancelled booking'
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(data.message || 'Booking cancelled and refund initiated successfully');
      setShowCancelDialog(false);
      fetchEventDetails();
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      toast.error(error.message || "Failed to cancel booking");
    }
  };

  const openCancelDialog = () => {
    calculateRefund();
    setShowCancelDialog(true);
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
  const isEventCreator = user && event.created_by === user.id;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        {/* Event Banner */}
        {event.poster_url && (
          <div className="aspect-[16/9] rounded-lg sm:rounded-2xl overflow-hidden mb-6 sm:mb-8 shadow-lg">
            <img 
              src={event.poster_url} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Event Header */}
        <div className="space-y-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">{event.category || 'Event'}</Badge>
                {isEventPast && <Badge variant="outline" className="text-xs">Past Event</Badge>}
                {isSlotsFull && !isEventPast && <Badge variant="destructive" className="text-xs">Sold Out</Badge>}
                <div className="ml-auto flex items-center gap-1">
                  <ShareDialog
                    url={`/events/${eventId}`}
                    title={event.title}
                    description={event.description}
                  />
                  {user && event.created_by !== user.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setReportDialogOpen(true)}
                    >
                      <Flag className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">{event.title}</h1>
              
              {/* Community Link */}
              {community && (
                <Link 
                  to={`/community/${community.id}/public`}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Hosted by {community.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}

              {/* Manage Button for Creator */}
              {isEventCreator && !isEventPast && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/events/${eventId}/dashboard`)}
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Manage Event
                </Button>
              )}
            </div>

            {/* Booking Status / Button */}
            <div className="shrink-0 self-start sm:self-center">
              {userBooking ? (
                <div className="sm:text-right space-y-2">
                  <Badge className="mb-2 text-xs">You're Booked</Badge>
                  <p className="text-xs sm:text-sm text-muted-foreground">Ticket: {userBooking.ticket_code}</p>
                  {!isEventPast && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={openCancelDialog}
                    >
                      Cancel Booking
                    </Button>
                  )}
                </div>
              ) : event.ticket_type === 'paid' ? (
                <div className="sm:text-right">
                  <p className="text-xl sm:text-2xl font-bold text-primary">₹{event.performer_ticket_price}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">per ticket</p>
                </div>
              ) : (
                <Badge variant="secondary" className="text-sm sm:text-lg px-3 py-1.5 sm:px-4 sm:py-2">Free Event</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Event Details Grid */}
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Date & Time */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold mb-1 text-sm sm:text-base">Date & Time</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {format(new Date(event.event_date), "EEE, MMM dd, yyyy")}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {format(new Date(event.event_date), "h:mm a")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Duration */}
          {event.duration && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold mb-1 text-sm sm:text-base">Duration</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{event.duration} minutes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          {event.location && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
                    <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold mb-1 text-sm sm:text-base">Location</p>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">{event.location}</p>
                    {event.city && <p className="text-xs sm:text-sm text-muted-foreground">{event.city}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* JaaS Meeting - For registered participants */}
          {userBooking && !isEventPast && (
            <Card className="sm:col-span-2">
              <CardContent className="p-4 sm:p-6">
                {showJaasMeeting ? (
                  <JaasMeeting 
                    eventId={eventId!} 
                    eventTitle={event.title}
                    onClose={() => setShowJaasMeeting(false)}
                  />
                ) : (
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
                      <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold mb-1 text-sm sm:text-base">Video Meeting</p>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                        Join the in-app video meeting with noise cancellation
                      </p>
                      <Button 
                        onClick={() => setShowJaasMeeting(true)}
                        className="gap-2"
                      >
                        <Video className="h-4 w-4" />
                        Join Meeting
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* External Meeting URL - Only for registered participants (fallback) */}
          {event.meeting_url && userBooking && !showJaasMeeting && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-lg bg-muted">
                    <ExternalLink className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold mb-1 text-sm sm:text-base">External Meeting Link</p>
                    <a 
                      href={(() => {
                        const raw = event.meeting_url.trim();
                        return /^https?:\/\//i.test(raw)
                          ? raw
                          : raw.startsWith("//")
                            ? `https:${raw}`
                            : `https://${raw}`;
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open External Link
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Online Event info - Only for non-participants */}
          {!userBooking && !isEventPast && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
                    <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold mb-1 text-sm sm:text-base">Online Event</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Video meeting with noise cancellation will be available to registered participants
                    </p>
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
                <div className="flex-1">
                  <p className="font-semibold mb-2">Capacity</p>
                  
                  {/* Performer slots */}
                  <div className="mb-2">
                    <p className="text-sm text-muted-foreground">
                      Performers: {performerCount}/{event.performer_slots} booked
                    </p>
                    {event.performer_slots - performerCount > 0 && (
                      <p className="text-xs text-primary">
                        {event.performer_slots - performerCount} available
                      </p>
                    )}
                  </div>
                  
                  {/* Audience slots */}
                  {event.audience_enabled && (
                    <div className="mb-2">
                      <p className="text-sm text-muted-foreground">
                        Audience: {audienceCount}/{event.audience_slots || 0} booked
                      </p>
                      {event.audience_slots > 0 && event.audience_slots - audienceCount > 0 && (
                        <p className="text-xs text-primary">
                          {event.audience_slots - audienceCount} available
                        </p>
                      )}
                      {event.audience_slots === 0 && audienceCount > 0 && (
                        <p className="text-xs text-amber-600">
                          Overbooked by {audienceCount}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Total availability */}
                  <div className="pt-2 border-t border-border mt-2">
                    <p className="text-sm font-semibold text-primary">
                      {availableSlots > 0 ? `${availableSlots} total slots available` : 'Event fully booked'}
                    </p>
                  </div>
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
              <CollapsibleDescription description={event.description} />
            </CardContent>
          </Card>
        )}

        {/* Performers Section - Social Proof */}
        {performers.length > 0 && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <Collapsible open={performersOpen} onOpenChange={setPerformersOpen}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    Performing Artists ({performers.length})
                  </h2>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-2">
                      <ChevronDown className={`h-5 w-5 transition-transform ${performersOpen ? 'transform rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {performers.map((performer) => (
                      <Link
                        key={performer.user_id}
                        to={`/profile/${performer.user_id}`}
                        className="flex flex-col items-center p-4 rounded-lg hover:bg-accent transition-colors group"
                      >
                        <div className="relative mb-3">
                          <div className="w-16 h-16 rounded-full overflow-hidden bg-muted ring-2 ring-border group-hover:ring-primary transition-all">
                            {performer.profile_picture_url ? (
                              <img
                                src={performer.profile_picture_url}
                                alt={performer.display_name || performer.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-semibold text-lg">
                                {(performer.display_name || performer.name).charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="font-medium text-sm text-center line-clamp-1">
                          {performer.display_name || performer.name}
                        </p>
                        {performer.skills && performer.skills.length > 0 && (
                          <p className="text-xs text-muted-foreground text-center line-clamp-1 mt-1">
                            {performer.skills[0]}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        )}

        {/* Spotlight Video Section - Show for past events especially */}
        {isEventPast && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Event Highlights</h2>
              {spotlight?.video_url ? (
                <div className="space-y-4">
                  <div className="aspect-[9/16] max-w-md mx-auto rounded-lg overflow-hidden bg-black">
                    <video
                      src={spotlight.video_url}
                      controls
                      className="w-full h-full object-contain"
                      playsInline
                    />
                  </div>
                  {spotlight.caption && (
                    <p className="text-sm text-muted-foreground text-center">{spotlight.caption}</p>
                  )}
                  <p className="text-xs text-muted-foreground text-center">Featured in ShowClips</p>
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Highlight Video Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isEventCreator 
                      ? "Upload a highlight video from your community dashboard to showcase this event"
                      : "The community owner hasn't uploaded a highlight video for this event yet"}
                  </p>
                  {isEventCreator && (
                    <Button variant="outline" onClick={() => navigate(`/community/${event.community_id}`)}>
                      Go to Dashboard
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Refund Policy */}
        {event.ticket_type === 'paid' && (
          <Card className="mb-8 border-muted">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">Cancellation & Refund Policy</h3>
              <p className="text-sm text-muted-foreground">
                Cancellations made 24 hours or more before the event are eligible for a full refund. 
                Cancellations within 2-24 hours will receive a 75% refund. No refunds for cancellations 
                within 2 hours of the event.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Booking CTA */}
        <div>
          {!userBooking && isEventPast ? (
            <Card className="border-muted">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">This event has ended</p>
              </CardContent>
            </Card>
          ) : !userBooking && isSlotsFull ? (
            <Card className="border-destructive">
              <CardContent className="p-6 text-center">
                <p className="font-semibold text-destructive mb-2">Event Sold Out</p>
                <p className="text-sm text-muted-foreground">All slots have been booked</p>
              </CardContent>
            </Card>
          ) : !userBooking ? (
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
          ) : null}
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div>
                Are you sure you want to cancel your booking for <strong>{event?.title}</strong>?
              </div>
              
              {event?.ticket_type === 'paid' && (
                <>
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold text-foreground">Refund Information</h4>
                    <div className="space-y-2 text-sm">
                      <p className="text-foreground">
                        <strong>Refund Amount:</strong> ₹{refundAmount} ({refundPercentage}% of ₹{refundBaseAmount})
                      </p>
                      {refundPercentage === 100 && (
                        <p className="text-green-600 dark:text-green-400">
                          ✓ Full refund - Cancelling 24+ hours before the event
                        </p>
                      )}
                      {refundPercentage === 75 && (
                        <p className="text-orange-600 dark:text-orange-400">
                          ⚠ 75% refund - Cancelling 2-24 hours before the event
                        </p>
                      )}
                      {refundPercentage === 0 && (
                        <p className="text-destructive">
                          ✗ No refund available - Cancelling within 2 hours of the event
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded text-xs space-y-1">
                    <p className="font-semibold text-foreground">Refund Policy:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>24+ hours before: 100% refund</li>
                      <li>2-24 hours before: 75% refund</li>
                      <li>Within 2 hours: No refund</li>
                    </ul>
                    {refundPercentage > 0 && (
                      <p className="mt-2 text-muted-foreground">
                        Refunds will be processed within 5-10 business days.
                      </p>
                    )}
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelBooking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Booking Success Drawer */}
      <Drawer open={showBookingDrawer} onOpenChange={setShowBookingDrawer}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle className="text-2xl">You're all set! 🎉</DrawerTitle>
            <DrawerDescription>
              Your booking confirmation has been sent to your email
            </DrawerDescription>
          </DrawerHeader>
          
          {userBooking && (
            <div className="px-4 pb-4">
              <div className="p-4 bg-primary/10 rounded-lg mb-4">
                <p className="text-sm text-muted-foreground mb-1">Ticket Code</p>
                <p className="font-mono font-bold text-lg">{userBooking.ticket_code}</p>
              </div>
            </div>
          )}
          
          <DrawerFooter>
            <div className="flex gap-3 w-full">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate("/profile")}
              >
                View My Bookings
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1"
                onClick={() => {
                  setShowBookingDrawer(false);
                  openCancelDialog();
                }}
              >
                Cancel Booking
              </Button>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Report Dialog */}
      {event && event.created_by && (
        <ReportDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          targetUserId={event.created_by}
          targetType="user"
          contextType="event"
          contextId={eventId}
        />
      )}
    </div>
  );
}
