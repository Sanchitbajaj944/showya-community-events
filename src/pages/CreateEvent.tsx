import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Upload, Ticket, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PromoCode = {
  code: string;
  discount_type: "percentage" | "flat";
  discount_value: number;
  applies_to: "performer" | "audience" | "both";
  usage_limit?: number;
  valid_until?: string;
};

export default function CreateEvent() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [community, setCommunity] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categories: [] as string[],
    event_date: "",
    duration: 60,
    poster_url: "",
    performer_slots: 1,
    performer_ticket_price: 20,
    audience_enabled: false,
    audience_slots: undefined as number | undefined,
    audience_ticket_price: undefined as number | undefined,
    meeting_url: "",
    location: "",
    city: "",
  });

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [newPromo, setNewPromo] = useState<PromoCode>({
    code: "",
    discount_type: "percentage",
    discount_value: 0,
    applies_to: "both",
  });

  useEffect(() => {
    if (communityId) {
      fetchCommunity();
    }
  }, [communityId]);

  const fetchCommunity = async () => {
    const { data, error } = await supabase
      .from("communities")
      .select("*")
      .eq("id", communityId)
      .single();

    if (data) {
      setCommunity(data);
    }
  };

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      setPosterFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPosterPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPoster = async (): Promise<string | null> => {
    if (!posterFile || !user) return null;

    const fileExt = posterFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('event-posters')
      .upload(fileName, posterFile);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      toast.error("Failed to upload the poster");
      return null;
    }

    const { data } = supabase.storage
      .from('event-posters')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const addPromoCode = () => {
    if (!newPromo.code || newPromo.discount_value <= 0) {
      toast.error("Please fill in all promo code fields");
      return;
    }
    setPromoCodes([...promoCodes, newPromo]);
    setNewPromo({
      code: "",
      discount_type: "percentage",
      discount_value: 0,
      applies_to: "both",
    });
    toast.success("Promo code added!");
  };

  const removePromoCode = (index: number) => {
    setPromoCodes(promoCodes.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!user || !communityId) return;

    // Only validate KYC for paid events (not free events)
    const isPaidEvent = formData.performer_ticket_price > 0 || (formData.audience_enabled && formData.audience_ticket_price && formData.audience_ticket_price > 0);
    
    if (isPaidEvent && community?.kyc_status !== "ACTIVATED") {
      toast.error("Complete KYC verification in Payouts section to create paid events. Free events don't require KYC.");
      return;
    }

    // Validate required fields
    if (!formData.title || formData.categories.length === 0 || !formData.event_date || !posterFile || !formData.meeting_url) {
      toast.error("Please fill in all required fields");
      setStep(1);
      return;
    }

    setLoading(true);

    try {
      // Upload poster
      const posterUrl = await uploadPoster();
      if (!posterUrl) {
        toast.error("Failed to upload poster");
        return;
      }

      // Create event
      const { data: event, error: eventError } = await supabase
        .from("events")
        .insert({
          title: formData.title,
          description: formData.description,
          category: formData.categories.join(", "),
          location: formData.location,
          city: formData.city,
          event_date: formData.event_date,
          duration: formData.duration,
          poster_url: posterUrl,
          performer_slots: formData.performer_slots,
          performer_ticket_price: formData.performer_ticket_price,
          audience_enabled: formData.audience_enabled,
          audience_slots: formData.audience_slots,
          audience_ticket_price: formData.audience_ticket_price,
          meeting_url: formData.meeting_url,
          ticket_type: "paid",
          price: formData.performer_ticket_price,
          community_id: communityId,
          community_name: community?.name || "",
          created_by: user.id,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Insert promo codes
      if (promoCodes.length > 0 && event) {
        const promoInserts = promoCodes.map(promo => ({
          event_id: event.id,
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

        if (promoError) console.error("Promo code error:", promoError);
      }

      toast.success("Event published successfully!");
      navigate(`/community/${communityId}`);
    } catch (error: any) {
      console.error("Error creating event:", error);
      toast.error(error.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const canProceedToStep2 = formData.title && formData.categories.length > 0 && formData.event_date && posterFile;
  const canProceedToStep3 = formData.performer_slots >= 1 && formData.performer_ticket_price >= 20 && formData.meeting_url;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(`/community/${communityId}`)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Community
        </Button>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 ${s <= step ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${s <= step ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {s}
                </div>
                <span className="text-sm font-medium hidden sm:inline">
                  {s === 1 ? 'Details' : s === 2 ? 'Slots & Pricing' : 'Preview'}
                </span>
              </div>
              {s < 3 && <div className={`h-0.5 w-8 sm:w-16 ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
            </React.Fragment>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {step === 1 ? 'Event Details' : step === 2 ? 'Slots & Pricing Setup' : 'Preview & Publish'}
            </CardTitle>
            <p className="text-muted-foreground">
              {community?.name && `for ${community.name}`}
            </p>
          </CardHeader>
          <CardContent>
            {/* Step 1: Event Details */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Event Name *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Open Mic Night"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    maxLength={80}
                    required
                  />
                  <p className="text-xs text-muted-foreground">{formData.title.length}/80 characters</p>
                </div>

                <div className="space-y-2">
                  <Label>Categories * (Select multiple)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {["Music", "Comedy", "Poetry", "Art", "Dance", "Theater", "Other"].map((cat) => (
                      <div key={cat} className="flex items-center space-x-2">
                        <Checkbox
                          id={cat}
                          checked={formData.categories.includes(cat)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({ ...prev, categories: [...prev.categories, cat] }));
                            } else {
                              setFormData(prev => ({ ...prev, categories: prev.categories.filter(c => c !== cat) }));
                            }
                          }}
                        />
                        <Label htmlFor={cat} className="font-normal cursor-pointer">{cat}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event_date">Date & Time *</Label>
                    <Input
                      id="event_date"
                      type="datetime-local"
                      value={formData.event_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                      min="1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (max 500 characters)</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your event..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    maxLength={500}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">{formData.description.length}/500 characters</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="poster">Event Poster / Thumbnail *</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="poster"
                      type="file"
                      accept="image/*"
                      onChange={handlePosterUpload}
                      className="hidden"
                    />
                    <Label
                      htmlFor="poster"
                      className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent"
                    >
                      <Upload className="h-4 w-4" />
                      {posterFile ? "Change Poster" : "Upload Poster"}
                    </Label>
                    {posterPreview && (
                      <img src={posterPreview} alt="Poster preview" className="h-20 w-20 object-cover rounded" />
                    )}
                  </div>
                  {!posterFile && <p className="text-xs text-destructive">Required</p>}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/community/${communityId}`)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!canProceedToStep2}
                    className="flex-1"
                  >
                    Next: Slots & Pricing
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Slots & Pricing */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-4 p-4 border rounded-lg bg-accent/5">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Performer Setup (Mandatory)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="performer_slots">Number of Performer Slots *</Label>
                      <Input
                        id="performer_slots"
                        type="number"
                        value={formData.performer_slots}
                        onChange={(e) => setFormData(prev => ({ ...prev, performer_slots: parseInt(e.target.value) || 1 }))}
                        min="1"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="performer_price">Performer Ticket Price (₹) *</Label>
                      <Input
                        id="performer_price"
                        type="number"
                        value={formData.performer_ticket_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, performer_ticket_price: parseFloat(e.target.value) || 20 }))}
                        min="20"
                        required
                      />
                      <p className="text-xs text-muted-foreground">Minimum ₹20</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4 border rounded-lg bg-accent/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Ticket className="h-5 w-5" />
                      Audience Setup (Optional)
                    </h3>
                    <Switch
                      checked={formData.audience_enabled}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, audience_enabled: checked }))}
                    />
                  </div>

                  {formData.audience_enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="audience_slots">Number of Audience Slots</Label>
                        <Input
                          id="audience_slots"
                          type="number"
                          placeholder="Leave blank for unlimited"
                          value={formData.audience_slots || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, audience_slots: e.target.value ? parseInt(e.target.value) : undefined }))}
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="audience_price">Audience Ticket Price (₹)</Label>
                        <Input
                          id="audience_price"
                          type="number"
                          placeholder="Optional"
                          value={formData.audience_ticket_price || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, audience_ticket_price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                          min="20"
                        />
                        <p className="text-xs text-muted-foreground">Minimum ₹20 if set</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meeting_url">Online Meeting Link *</Label>
                  <Input
                    id="meeting_url"
                    type="url"
                    placeholder="https://meet.google.com/xxx or https://zoom.us/j/xxx"
                    value={formData.meeting_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, meeting_url: e.target.value }))}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Only visible to registered performers and audience</p>
                </div>

                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="font-semibold">Promo Codes (Optional)</h3>
                  
                  {promoCodes.length > 0 && (
                    <div className="space-y-2">
                      {promoCodes.map((promo, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-accent/10 rounded">
                          <div className="flex items-center gap-2">
                            <Badge>{promo.code}</Badge>
                            <span className="text-sm">
                              {promo.discount_type === "percentage" ? `${promo.discount_value}%` : `₹${promo.discount_value}`} off
                              {" for "}{promo.applies_to}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePromoCode(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Code (e.g., EARLY50)"
                      value={newPromo.code}
                      onChange={(e) => setNewPromo(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Value"
                        value={newPromo.discount_value || ""}
                        onChange={(e) => setNewPromo(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                        min="1"
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
                  </div>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={newPromo.applies_to}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, applies_to: e.target.value as "performer" | "audience" | "both" }))}
                  >
                    <option value="both">Applies to Both</option>
                    <option value="performer">Performers Only</option>
                    <option value="audience">Audience Only</option>
                  </select>
                  <Button type="button" variant="outline" onClick={addPromoCode} className="w-full">
                    Add Promo Code
                  </Button>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={!canProceedToStep3}
                    className="flex-1"
                  >
                    Next: Preview
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Preview & Publish */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  {posterPreview && (
                    <img src={posterPreview} alt="Event poster" className="w-full h-64 object-cover rounded-lg" />
                  )}

                  <div>
                    <h3 className="text-2xl font-bold">{formData.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.categories.map(cat => (
                        <Badge key={cat} variant="secondary">{cat}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Date & Time</p>
                      <p className="font-medium">{new Date(formData.event_date).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-medium">{formData.duration} minutes</p>
                    </div>
                  </div>

                  {formData.description && (
                    <div>
                      <p className="text-muted-foreground text-sm">Description</p>
                      <p className="mt-1">{formData.description}</p>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Ticket Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-accent/10 rounded">
                        <div>
                          <p className="font-medium">Performer Slots</p>
                          <p className="text-sm text-muted-foreground">{formData.performer_slots} slots available</p>
                        </div>
                        <p className="text-lg font-bold">₹{formData.performer_ticket_price}</p>
                      </div>

                      {formData.audience_enabled && (
                        <div className="flex justify-between items-center p-3 bg-accent/10 rounded">
                          <div>
                            <p className="font-medium">Audience Slots</p>
                            <p className="text-sm text-muted-foreground">
                              {formData.audience_slots ? `${formData.audience_slots} slots` : "Unlimited"}
                            </p>
                          </div>
                          <p className="text-lg font-bold">
                            {formData.audience_ticket_price ? `₹${formData.audience_ticket_price}` : "Free"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {promoCodes.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Active Promo Codes</h4>
                      <div className="space-y-2">
                        {promoCodes.map((promo, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-accent/10 rounded">
                            <Badge>{promo.code}</Badge>
                            <span className="text-sm">
                              {promo.discount_type === "percentage" ? `${promo.discount_value}%` : `₹${promo.discount_value}`} off
                              {" for "}{promo.applies_to}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePublish}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? "Publishing..." : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Publish Event
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
