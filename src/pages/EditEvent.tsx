import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Calendar, Clock, MapPin, Users, Link as LinkIcon, Image, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function EditEvent() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [showDateChangeWarning, setShowDateChangeWarning] = useState(false);
  const [isWithinRestrictedWindow, setIsWithinRestrictedWindow] = useState(false);
  const [restrictedMinutes, setRestrictedMinutes] = useState(60);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    duration: 60,
    location: "",
    city: "",
    category: "",
    poster_url: "",
    meeting_url: "",
    performer_slots: 1,
    audience_enabled: false,
    audience_slots: 0,
  });

  useEffect(() => {
    fetchEventData();
  }, [eventId, user]);

  const fetchEventData = async () => {
    if (!eventId || !user) return;

    try {
      setLoading(true);

      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      // Check if user is creator
      if (eventData.created_by !== user.id) {
        toast.error("You don't have permission to edit this event");
        navigate(`/events/${eventId}`);
        return;
      }

      setEvent(eventData);

      // Check time until event
      const eventDate = new Date(eventData.event_date);
      const now = new Date();
      const minutesUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60);
      const editableMinutes = eventData.editable_before_event_minutes || 60;
      
      setRestrictedMinutes(editableMinutes);
      setIsWithinRestrictedWindow(minutesUntilEvent <= editableMinutes);

      // Get booking count
      const { data: bookings } = await supabase
        .from("event_participants")
        .select("id")
        .eq("event_id", eventId);

      setBookingCount(bookings?.length || 0);

      // Set form data
      setFormData({
        title: eventData.title || "",
        description: eventData.description || "",
        event_date: eventData.event_date ? format(new Date(eventData.event_date), "yyyy-MM-dd'T'HH:mm") : "",
        duration: eventData.duration || 60,
        location: eventData.location || "",
        city: eventData.city || "",
        category: eventData.category || "",
        poster_url: eventData.poster_url || "",
        meeting_url: eventData.meeting_url || "",
        performer_slots: eventData.performer_slots || 1,
        audience_enabled: eventData.audience_enabled || false,
        audience_slots: eventData.audience_slots || 0,
      });

    } catch (error: any) {
      console.error("Error fetching event:", error);
      toast.error("Failed to load event data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (confirmDateChange = false) => {
    if (!eventId || !user) return;

    try {
      setSubmitting(true);

      // Check if date changed
      const originalDate = event?.event_date;
      const newDate = new Date(formData.event_date).toISOString();
      const isDateChanged = originalDate !== newDate;

      if (isDateChanged && bookingCount > 0 && !confirmDateChange) {
        setShowDateChangeWarning(true);
        setSubmitting(false);
        return;
      }

      // Prepare updates
      const updates: any = {
        title: formData.title,
        description: formData.description,
        event_date: newDate,
        duration: formData.duration,
        location: formData.location,
        city: formData.city,
        category: formData.category,
        poster_url: formData.poster_url,
        meeting_url: formData.meeting_url,
        performer_slots: formData.performer_slots,
        audience_enabled: formData.audience_enabled,
        audience_slots: formData.audience_slots,
      };

      // Call edge function
      const { data, error } = await supabase.functions.invoke("update-event", {
        body: {
          eventId,
          updates,
          confirmDateChange: confirmDateChange || !isDateChanged
        }
      });

      if (error) throw error;

      if (data.error) {
        if (data.error === "date_change_confirmation_required") {
          setShowDateChangeWarning(true);
          return;
        }
        throw new Error(data.message || "Failed to update event");
      }

      toast.success(
        data.notificationsSent > 0 
          ? `Event updated successfully. ${data.notificationsSent} attendees notified.`
          : "Event updated successfully"
      );
      
      navigate(`/events/${eventId}`);

    } catch (error: any) {
      console.error("Error updating event:", error);
      toast.error(error.message || "Failed to update event");
    } finally {
      setSubmitting(false);
    }
  };

  const isFieldLocked = (field: string) => {
    if (bookingCount === 0) return false;
    
    const lockedFieldsWithBookings = ["ticket_type", "performer_ticket_price", "audience_ticket_price"];
    return lockedFieldsWithBookings.includes(field);
  };

  const isFieldDisabled = (field: string) => {
    if (!isWithinRestrictedWindow) return false;
    
    // Only meeting_url is editable within restricted window
    return field !== "meeting_url";
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

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Edit Event</h1>
          {bookingCount > 0 && (
            <Badge variant="secondary" className="mb-2">
              <Users className="h-3 w-3 mr-1" />
              {bookingCount} attendees booked
            </Badge>
          )}
          {isWithinRestrictedWindow && (
            <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg mt-2">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-orange-500">Limited Editing Window</p>
                <p className="text-muted-foreground">
                  Event starts within {restrictedMinutes} minutes. Only meeting link can be updated.
                </p>
              </div>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div>
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isFieldDisabled("title")}
                placeholder="Enter event title"
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isFieldDisabled("description")}
                placeholder="Describe your event"
                rows={4}
                className="mt-1"
              />
            </div>

            {/* Date & Time */}
            <div>
              <Label htmlFor="event_date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Event Date & Time *
                {bookingCount > 0 && (
                  <Badge variant="outline" className="text-xs">Will notify attendees</Badge>
                )}
              </Label>
              <Input
                id="event_date"
                type="datetime-local"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                disabled={isFieldDisabled("event_date")}
                className="mt-1"
              />
            </div>

            {/* Duration */}
            <div>
              <Label htmlFor="duration" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duration (minutes) *
              </Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                disabled={isFieldDisabled("duration")}
                min="15"
                step="15"
                className="mt-1"
              />
            </div>

            {/* Location */}
            <div>
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                disabled={isFieldDisabled("location")}
                placeholder="Event venue or address"
                className="mt-1"
              />
            </div>

            {/* City */}
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                disabled={isFieldDisabled("city")}
                placeholder="City name"
                className="mt-1"
              />
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                disabled={isFieldDisabled("category")}
                placeholder="e.g., Music, Comedy, Art"
                className="mt-1"
              />
            </div>

            {/* Poster URL */}
            <div>
              <Label htmlFor="poster_url" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Event Poster URL
              </Label>
              <Input
                id="poster_url"
                value={formData.poster_url}
                onChange={(e) => setFormData({ ...formData, poster_url: e.target.value })}
                disabled={isFieldDisabled("poster_url")}
                placeholder="https://..."
                className="mt-1"
              />
            </div>

            {/* Meeting URL */}
            <div>
              <Label htmlFor="meeting_url" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Meeting Link
                <Badge variant="secondary" className="text-xs">Always editable</Badge>
                {bookingCount > 0 && (
                  <Badge variant="outline" className="text-xs">Will notify attendees</Badge>
                )}
              </Label>
              <Input
                id="meeting_url"
                value={formData.meeting_url}
                onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                placeholder="https://meet.google.com/... or Zoom link"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Can be updated anytime, even during the event
              </p>
            </div>

            {/* Performer Slots */}
            <div>
              <Label htmlFor="performer_slots" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Performer Slots *
                {bookingCount > 0 && (
                  <Badge variant="outline" className="text-xs">Cannot reduce below bookings</Badge>
                )}
              </Label>
              <Input
                id="performer_slots"
                type="number"
                value={formData.performer_slots}
                onChange={(e) => setFormData({ ...formData, performer_slots: parseInt(e.target.value) })}
                disabled={isFieldDisabled("performer_slots")}
                min="1"
                className="mt-1"
              />
            </div>

            {/* Audience Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="audience_enabled">Enable Audience Seats</Label>
                <p className="text-xs text-muted-foreground">Allow non-performers to attend</p>
              </div>
              <Switch
                id="audience_enabled"
                checked={formData.audience_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, audience_enabled: checked })}
                disabled={isFieldDisabled("audience_enabled")}
              />
            </div>

            {/* Audience Slots */}
            {formData.audience_enabled && (
              <div>
                <Label htmlFor="audience_slots">Audience Seats *</Label>
                <Input
                  id="audience_slots"
                  type="number"
                  value={formData.audience_slots}
                  onChange={(e) => setFormData({ ...formData, audience_slots: parseInt(e.target.value) })}
                  disabled={isFieldDisabled("audience_slots")}
                  min="0"
                  className="mt-1"
                />
              </div>
            )}

            {/* Locked Fields Notice */}
            {bookingCount > 0 && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-semibold">Locked Fields (Cannot Edit After Bookings)</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                  <li>Ticket Type (Free/Paid)</li>
                  <li>Performer Ticket Price</li>
                  <li>Audience Ticket Price</li>
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => handleSubmit()}
                disabled={submitting || !formData.title || !formData.event_date}
                className="flex-1"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/events/${eventId}`)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNav />

      {/* Date Change Warning Dialog */}
      <AlertDialog open={showDateChangeWarning} onOpenChange={setShowDateChangeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Date/Time Change</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">
                    {bookingCount} {bookingCount === 1 ? "attendee" : "attendees"} will be notified
                  </p>
                  <p className="text-muted-foreground mt-1">
                    All attendees will receive a notification about the date/time change. 
                    They will have the option to cancel their booking for a refund based on the cancellation policy.
                  </p>
                </div>
              </div>
              <p>Are you sure you want to change the event date/time?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowDateChangeWarning(false);
              handleSubmit(true);
            }}>
              Confirm & Notify Attendees
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}