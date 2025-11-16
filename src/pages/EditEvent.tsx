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
import { Calendar, Clock, MapPin, Users, Link as LinkIcon, Image, AlertTriangle, Trash2 } from "lucide-react";
import { CropImageDialog } from "@/components/CropImageDialog";
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isWithinRestrictedWindow, setIsWithinRestrictedWindow] = useState(false);
  const [restrictedMinutes, setRestrictedMinutes] = useState(60);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    duration: 60,
    category: "",
    poster_url: "",
    meeting_url: "",
    performer_slots: 1,
    audience_enabled: false,
    audience_slots: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>("");

  useEffect(() => {
    fetchEventData();
  }, [eventId, user]);

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      e.target.value = ''; // Reset input
      return;
    }

    // Validate file size (max 10MB before optimization)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      e.target.value = ''; // Reset input
      return;
    }

    // Create object URL for crop dialog
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setCropDialogOpen(true);
    
    // Reset file input
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      setUploading(true);

      // Generate unique filename
      const fileName = `${eventId}-${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('event-posters')
        .upload(filePath, croppedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('event-posters')
        .getPublicUrl(filePath);

      // Update form data
      setFormData({ ...formData, poster_url: publicUrl });
      toast.success('Poster uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading poster:', error);
      toast.error('Failed to upload poster');
    } finally {
      setUploading(false);
      // Clean up object URL
      if (imageToCrop) {
        URL.revokeObjectURL(imageToCrop);
        setImageToCrop('');
      }
    }
  };

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

  const handleDeleteEvent = async () => {
    if (!eventId || !user) return;

    // Validate confirmation text
    if (deleteConfirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm');
      return;
    }

    try {
      setIsDeleting(true);

      // Get current session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to delete events");
      }

      const { data, error } = await supabase.functions.invoke("delete-event", {
        body: { eventId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(data.message);
      navigate("/events");

    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast.error(error.message || "Failed to delete event");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
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

            {/* Event Poster Upload */}
            <div>
              <Label htmlFor="poster" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Event Poster
              </Label>
              <div className="space-y-3 mt-1">
                {formData.poster_url && (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border group">
                    <img 
                      src={formData.poster_url} 
                      alt="Event poster" 
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setFormData({ ...formData, poster_url: "" })}
                      disabled={isFieldDisabled("poster_url")}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    id="poster"
                    type="file"
                    accept="image/*"
                    onChange={handlePosterUpload}
                    disabled={isFieldDisabled("poster_url") || uploading}
                    className="cursor-pointer flex-1"
                  />
                </div>
                {uploading && (
                  <p className="text-xs text-muted-foreground">Processing and uploading poster...</p>
                )}
                {!formData.poster_url && !uploading && (
                  <p className="text-xs text-muted-foreground">
                    Upload an image. You'll be able to crop and optimize it before saving.
                  </p>
                )}
              </div>
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
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={submitting || (isWithinRestrictedWindow && restrictedMinutes < 60)}
              >
                Delete Event
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Event
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              {bookingCount > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-foreground mb-1">This event has {bookingCount} attendees</p>
                      <p className="text-muted-foreground">
                        The event will be cancelled and all attendees will be notified.
                        {event?.ticket_type === 'paid' && ' Full refunds will be processed for all paid tickets.'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone. Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm.
                  </p>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                    className="mt-2"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm">
                    Are you sure you want to delete this event? This action cannot be undone.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm.
                  </p>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                    className="mt-2"
                  />
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setDeleteConfirmText("");
                setShowDeleteDialog(false);
              }}
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteEvent}
              disabled={isDeleting || deleteConfirmText !== "DELETE"}
            >
              {isDeleting ? "Deleting..." : "Delete Event"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Crop Image Dialog */}
      <CropImageDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={imageToCrop}
        onCropComplete={handleCropComplete}
        aspectRatio={16 / 9}
      />
    </div>
  );
}