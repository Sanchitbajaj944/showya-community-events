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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MapPin, IndianRupee } from "lucide-react";

export default function CreateEvent() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [community, setCommunity] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    location: "",
    city: "",
    event_date: "",
    ticket_type: "free",
    price: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !communityId) return;

    // Validate paid events require KYC
    if (formData.ticket_type === "paid" && community?.kyc_status !== "ACTIVATED") {
      toast.error("Complete KYC verification to create paid events");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("events").insert({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        location: formData.location,
        city: formData.city,
        event_date: formData.event_date,
        ticket_type: formData.ticket_type,
        price: formData.ticket_type === "paid" ? parseFloat(formData.price) : null,
        community_id: communityId,
        community_name: community?.name || "",
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Event created successfully!");
      navigate(`/community/${communityId}`);
    } catch (error: any) {
      console.error("Error creating event:", error);
      toast.error(error.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canCreatePaidEvents = community?.kyc_status === "ACTIVATED";

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button
          variant="ghost"
          onClick={() => navigate(`/community/${communityId}`)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Community
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create Event</CardTitle>
            <p className="text-muted-foreground">
              {community?.name && `for ${community.name}`}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Event Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Open Mic Night"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your event..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  required
                  rows={4}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(val) => handleChange("category", val)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Music">Music</SelectItem>
                    <SelectItem value="Comedy">Comedy</SelectItem>
                    <SelectItem value="Poetry">Poetry</SelectItem>
                    <SelectItem value="Art">Art</SelectItem>
                    <SelectItem value="Dance">Dance</SelectItem>
                    <SelectItem value="Theater">Theater</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date & Time */}
              <div className="space-y-2">
                <Label htmlFor="event_date">Date & Time *</Label>
                <Input
                  id="event_date"
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => handleChange("event_date", e.target.value)}
                  required
                />
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Venue *</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Blue Frog"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Mumbai"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Ticket Type */}
              <div className="space-y-2">
                <Label htmlFor="ticket_type">Ticket Type *</Label>
                <Select 
                  value={formData.ticket_type} 
                  onValueChange={(val) => {
                    handleChange("ticket_type", val);
                    if (val === "free") {
                      handleChange("price", "");
                    }
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid" disabled={!canCreatePaidEvents}>
                      Paid {!canCreatePaidEvents && "(KYC Required)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price (only for paid events) */}
              {formData.ticket_type === "paid" && (
                <div className="space-y-2">
                  <Label htmlFor="price">Ticket Price (₹) *</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="price"
                      type="number"
                      placeholder="299"
                      value={formData.price}
                      onChange={(e) => handleChange("price", e.target.value)}
                      className="pl-10"
                      required
                      min="1"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/community/${communityId}`)}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Creating..." : "Create Event"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
