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
import imageCompression from "browser-image-compression";
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

type PromoCode = {
  id?: string;
  code: string;
  discount_type: "percentage" | "flat";
  discount_value: number;
  applies_to: "performer" | "audience" | "all";
  usage_limit?: number;
  valid_until?: string;
};

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
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [newPromo, setNewPromo] = useState<PromoCode>({
    code: "",
    discount_type: "percentage",
    discount_value: 0,
    applies_to: "performer",
  });

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
    audience_ticket_price: undefined as number | undefined,
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchEventData();
  }, [eventId, user]);

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      e.target.value = '';
      return;
    }

    // Validate file size (max 10MB before optimization)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      e.target.value = '';
      return;
    }

    try {
      setUploading(true);

      // Compress and optimize the image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.85,
      };

      const compressedFile = await imageCompression(file, options);
      const finalSize = (compressedFile.size / 1024).toFixed(2);

      // Generate unique filename
      const fileName = `${eventId}-${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('event-posters')
        .upload(filePath, compressedFile, {
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
      toast.success(`Poster uploaded (${finalSize} KB)`);
    } catch (error: any) {
      console.error('Error uploading poster:', error);
      toast.error('Failed to upload poster');
    } finally {
      setUploading(false);
      e.target.value = '';
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

      // Fetch promo codes
      const { data: promoCodesData } = await supabase
        .from("promocodes")
        .select("*")
        .eq("event_id", eventId);
      
      if (promoCodesData) {
        setPromoCodes(promoCodesData.map(p => ({
          id: p.id,
          code: p.code,
          discount_type: p.discount_type as "percentage" | "flat",
          discount_value: p.discount_value,
          applies_to: p.applies_to as "performer" | "audience" | "all",
          usage_limit: p.usage_limit || undefined,
          valid_until: p.valid_until || undefined,
        })));
      }

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
        audience_ticket_price: eventData.audience_ticket_price || undefined,
      });

    } catch (error: any) {
      console.error("Error fetching event:", error);
      toast.error("Failed to load event data");
    } finally {
      setLoading(false);
    }
  };

  const addPromoCode = () => {
    if (!newPromo.code.trim()) {
      toast.error("Please enter a promo code");
      return;
    }
    if (newPromo.discount_value <= 0) {
      toast.error("Discount value must be greater than 0");
      return;
    }
    setPromoCodes([...promoCodes, newPromo]);
    setNewPromo({
      code: "",
      discount_type: "percentage",
      discount_value: 0,
      applies_to: "performer",
    });
    toast.success("Promo code added!");
  };

  const removePromoCode = async (index: number) => {
    const promo = promoCodes[index];
    
    // If promo has an ID, delete from database immediately
    if (promo.id) {
      try {
        const { error } = await supabase
          .from("promocodes")
          .delete()
          .eq("id", promo.id);
        
        if (error) throw error;
        toast.success("Promo code deleted");
      } catch (error: any) {
        console.error("Error deleting promo code:", error);
        toast.error("Failed to delete promo code");
        return;
      }
    }
    
    setPromoCodes(promoCodes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (confirmDateChange = false) => {
    if (!eventId || !user) return;

    try {
      setSubmitting(true);

      // Convert local datetime to proper ISO string with timezone
      // The datetime-local input gives us a local time string, we need to convert it to UTC
      const localDate = new Date(formData.event_date);
      const newDate = localDate.toISOString();
      
      // Check if date changed
      const originalDate = event?.event_date;
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
        audience_ticket_price: formData.audience_ticket_price,
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

      // Save new promo codes (ones without IDs)
      const newPromoCodes = promoCodes.filter(p => !p.id);
      if (newPromoCodes.length > 0) {
        const promoInserts = newPromoCodes.map(promo => ({
          event_id: eventId,
          code: promo.code,
          discount_type: promo.discount_type,
          discount_value: promo.discount_value,
          applies_to: promo.applies_to,
          usage_limit: promo.usage_limit,
          valid_until: promo.valid_until,
        }));

        const { error: promoError } = await supabase
          .from("promocodes")
          .insert(promoInserts);

        if (promoError) {
          console.error("Error saving promo codes:", promoError);
          toast.error("Event updated but failed to save some promo codes");
        }
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
                  <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border">
                    <img 
                      src={formData.poster_url} 
                      alt="Event poster" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    id="poster"
                    type="file"
                    accept="image/*"
                    onChange={handlePosterUpload}
                    disabled={uploading}
                    className="cursor-pointer flex-1"
                  />
                  {formData.poster_url && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="default"
                      onClick={() => setFormData({ ...formData, poster_url: "" })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                {uploading && (
                  <p className="text-xs text-muted-foreground">Optimizing and uploading poster...</p>
                )}
                {!formData.poster_url && !uploading && (
                  <p className="text-xs text-muted-foreground">
                    Recommended: 16:9 aspect ratio (e.g., 1920x1080px). Image will be automatically optimized.
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
              <>
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

                {/* Audience Ticket Price - only for paid events */}
                {event?.ticket_type === 'paid' && (
                  <div>
                    <Label htmlFor="audience_ticket_price">Audience Ticket Price (₹) *</Label>
                    <Input
                      id="audience_ticket_price"
                      type="number"
                      value={formData.audience_ticket_price || ""}
                      onChange={(e) => setFormData({ ...formData, audience_ticket_price: e.target.value ? parseFloat(e.target.value) : undefined })}
                      disabled={isFieldDisabled("audience_ticket_price")}
                      min="20"
                      placeholder="Minimum ₹20"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Required for paid events - Minimum ₹20</p>
                  </div>
                )}
              </>
            )}

            {/* Promo Codes Section */}
            {event?.ticket_type === 'paid' && (
              <div className="space-y-3">
                <div>
                  <Label>Promo Codes</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Create discount codes for this event
                  </p>
                </div>

                {/* Existing Promo Codes */}
                {promoCodes.length > 0 && (
                  <div className="space-y-2">
                    {promoCodes.map((promo, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-accent/10 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{promo.code}</Badge>
                          <span className="text-sm">
                            {promo.discount_type === "percentage" ? `${promo.discount_value}%` : `₹${promo.discount_value}`} off
                            {" for "}{promo.applies_to === "all" ? "both tickets" : promo.applies_to}
                          </span>
                          {promo.usage_limit && (
                            <span className="text-xs text-muted-foreground">
                              (Limit: {promo.usage_limit})
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePromoCode(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Promo Code */}
                <div className="space-y-2 p-3 border rounded-lg">
                  <Label className="text-sm font-semibold">Add New Promo Code</Label>
                  <Input
                    placeholder="Promo code (e.g., SAVE20)"
                    value={newPromo.code}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    maxLength={20}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Discount value"
                      value={newPromo.discount_value || ""}
                      onChange={(e) => setNewPromo(prev => ({ ...prev, discount_value: parseFloat(e.target.value) }))}
                      min="0"
                      className="flex-1"
                    />
                    <select
                      className="px-3 py-2 border rounded-md"
                      value={newPromo.discount_type}
                      onChange={(e) => setNewPromo(prev => ({ ...prev, discount_type: e.target.value as "percentage" | "flat" }))}
                    >
                      <option value="percentage">%</option>
                      <option value="flat">₹</option>
                    </select>
                  </div>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={newPromo.applies_to}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, applies_to: e.target.value as "performer" | "audience" | "all" }))}
                  >
                    <option value="performer">Performers Only</option>
                    <option value="audience">Audience Only</option>
                    <option value="all">Both Tickets</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="Usage limit (optional)"
                    value={newPromo.usage_limit || ""}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, usage_limit: e.target.value ? parseInt(e.target.value) : undefined }))}
                    min="1"
                  />
                  <Input
                    type="date"
                    placeholder="Valid until (optional)"
                    value={newPromo.valid_until || ""}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, valid_until: e.target.value }))}
                  />
                  <Button type="button" variant="outline" onClick={addPromoCode} className="w-full">
                    Add Promo Code
                  </Button>
                </div>
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
    </div>
  );
}