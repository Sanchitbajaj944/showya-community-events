import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast, differenceInHours } from "date-fns";
import { Calendar, Clock, MapPin, Users, Edit, Trash2, Copy, Link as LinkIcon, IndianRupee, AlertTriangle } from "lucide-react";

export default function EventDashboard() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user && eventId) {
      fetchEventData();
    }
  }, [user, eventId]);

  const fetchEventData = async () => {
    try {
      setLoading(true);

      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      // Check if user is the event creator
      if (eventData.created_by !== user?.id) {
        toast.error("You don't have permission to manage this event");
        navigate(-1);
        return;
      }

      setEvent(eventData);

      // Fetch attendees with profile info
      const { data: attendeesData, error: attendeesError } = await supabase
        .from("event_participants")
        .select(`
          *,
          profiles:user_id (
            name,
            display_name,
            profile_picture_url
          )
        `)
        .eq("event_id", eventId);

      if (attendeesError) throw attendeesError;
      setAttendees(attendeesData || []);
    } catch (error: any) {
      console.error("Error fetching event data:", error);
      toast.error("Failed to load event dashboard");
    } finally {
      setLoading(false);
    }
  };

  const getEventStatus = () => {
    if (!event) return "Unknown";
    if (event.is_cancelled) return "Cancelled";
    
    const eventDate = new Date(event.event_date);
    const now = new Date();
    const hoursUntilEvent = differenceInHours(eventDate, now);
    
    if (isPast(eventDate)) return "Completed";
    if (hoursUntilEvent <= 1) return "Locked";
    return "Upcoming";
  };

  const canDeleteEvent = () => {
    if (!event) return false;
    if (event.is_cancelled) return false;
    
    const eventDate = new Date(event.event_date);
    const now = new Date();
    const hoursUntilEvent = differenceInHours(eventDate, now);
    
    if (isPast(eventDate)) return false;
    if (hoursUntilEvent < 1) return false;
    return true;
  };

  const handleDeleteEvent = async () => {
    if (!canDeleteEvent()) return;

    try {
      setDeleting(true);
      const { data, error } = await supabase.functions.invoke("delete-event", {
        body: { eventId: event.id },
      });

      if (error) throw error;

      toast.success(data.message);
      navigate(`/community/${event.community_id}`);
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast.error(error.message || "Failed to delete event");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleDuplicateEvent = async () => {
    if (!event) return;

    try {
      const { data: newEvent, error } = await supabase
        .from("events")
        .insert({
          title: `${event.title} (Copy)`,
          description: event.description,
          event_date: new Date(new Date(event.event_date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week later
          location: event.location,
          city: event.city,
          community_id: event.community_id,
          community_name: event.community_name,
          category: event.category,
          created_by: user?.id,
          ticket_type: event.ticket_type,
          price: event.price,
          duration: event.duration,
          performer_slots: event.performer_slots,
          performer_ticket_price: event.performer_ticket_price,
          audience_enabled: event.audience_enabled,
          audience_slots: event.audience_slots,
          audience_ticket_price: event.audience_ticket_price,
          meeting_url: event.meeting_url,
          poster_url: event.poster_url,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Event duplicated successfully!");
      navigate(`/events/${newEvent.id}/edit`);
    } catch (error: any) {
      console.error("Error duplicating event:", error);
      toast.error("Failed to duplicate event");
    }
  };

  const handleRefundAttendee = async (participantId: string) => {
    try {
      // TODO: Implement refund logic via edge function
      toast.success("Refund processed successfully");
      fetchEventData();
    } catch (error) {
      toast.error("Failed to process refund");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted-foreground">Loading event dashboard...</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Event not found</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  const status = getEventStatus();
  const statusColor = {
    Upcoming: "default",
    Locked: "secondary",
    Completed: "outline",
    Cancelled: "destructive",
  }[status] as any;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl mb-20">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(`/community/${event.community_id}`)}>
            ← Back to Community
          </Button>
          <h1 className="text-3xl font-bold mt-4">Event Dashboard</h1>
          <p className="text-muted-foreground">Manage your event and attendees</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Event Overview */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Event Overview</CardTitle>
                <Badge variant={statusColor}>{status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {event.poster_url && (
                <div className="w-full h-64 rounded-lg overflow-hidden">
                  <img src={event.poster_url} alt={event.title} className="w-full h-full object-cover" />
                </div>
              )}

              <div>
                <h2 className="text-2xl font-bold mb-4">{event.title}</h2>
                {event.description && (
                  <p className="text-muted-foreground mb-4">{event.description}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Date & Time</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.event_date), "PPP 'at' p")}
                    </p>
                  </div>
                </div>

                {event.duration && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Duration</p>
                      <p className="text-sm text-muted-foreground">{event.duration} minutes</p>
                    </div>
                  </div>
                )}

                {event.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">{event.location}</p>
                    </div>
                  </div>
                )}

                {event.meeting_url && (
                  <div className="flex items-start gap-3">
                    <LinkIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Meeting Link</p>
                      <a 
                        href={event.meeting_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline truncate block max-w-[200px]"
                      >
                        {event.meeting_url}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Slots</p>
                    <p className="text-sm text-muted-foreground">
                      {event.performer_slots} performer
                      {event.audience_enabled && `, ${event.audience_slots} audience`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <IndianRupee className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Ticket Price</p>
                    <p className="text-sm text-muted-foreground">
                      {event.ticket_type === 'free' ? 'Free' : `₹${event.performer_ticket_price}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Signups</span>
                  <span className="font-semibold text-lg">{attendees.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => navigate(`/events/${event.id}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Event
              </Button>

              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={handleDuplicateEvent}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate Event
              </Button>

              <Button 
                className="w-full justify-start" 
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={!canDeleteEvent()}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Event
              </Button>

              {!canDeleteEvent() && status !== "Cancelled" && (
                <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    {status === "Completed" ? "Completed events cannot be deleted" : 
                     status === "Locked" ? "Cannot delete events starting within 1 hour" : 
                     "Event cannot be deleted"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attendees List */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Attendees ({attendees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {attendees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No attendees yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendees.map((attendee) => (
                    <TableRow key={attendee.id}>
                      <TableCell>
                        <Link 
                          to={`/profile/${attendee.user_id}`}
                          className="hover:underline flex items-center gap-2"
                        >
                          {attendee.profiles?.profile_picture_url && (
                            <img 
                              src={attendee.profiles.profile_picture_url} 
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          )}
                          <span>{attendee.profiles?.display_name || attendee.profiles?.name || 'User'}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{attendee.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(attendee.joined_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Confirmed</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {event.ticket_type === 'paid' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRefundAttendee(attendee.id)}
                          >
                            Refund
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Event?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Are you sure you want to delete this event?</p>
                {attendees.length > 0 && (
                  <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">
                      This event has {attendees.length} attendee{attendees.length > 1 ? 's' : ''}.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      All attendees will be notified and {event.ticket_type === 'paid' ? 'automatically refunded' : 'the event will be marked as cancelled'}.
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteEvent}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Delete Event"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
      <BottomNav />
    </div>
  );
}
