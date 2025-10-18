import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KycAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onComplete: () => void;
  initialValues?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

export const KycAddressDialog = ({ open, onOpenChange, userId, onComplete, initialValues }: KycAddressDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    street1: "",
    street2: "",
    city: "",
    state: "",
    postal_code: ""
  });

  // Pre-fill with initial values when dialog opens
  React.useEffect(() => {
    if (open && initialValues) {
      setFormData({
        street1: initialValues.street1 || "",
        street2: initialValues.street2 || "",
        city: initialValues.city || "",
        state: initialValues.state || "",
        postal_code: initialValues.postal_code || ""
      });
    }
  }, [open, initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.street1 || !formData.city || !formData.state || !formData.postal_code) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate postal code (6 digits)
    if (!/^\d{6}$/.test(formData.postal_code)) {
      toast.error("Please enter a valid 6-digit postal code");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          street1: formData.street1,
          street2: formData.street2 || null,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Address saved successfully");
      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      console.error("Error saving address:", error);
      toast.error("Failed to save address");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Your Address</DialogTitle>
          <DialogDescription>
            {initialValues?.street1 
              ? "Your previous address is shown below. Please verify or update it if needed."
              : "We need your address information to start the KYC verification process."
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street1">Street Address Line 1 *</Label>
            <Input
              id="street1"
              placeholder="Building number, street name"
              value={formData.street1}
              onChange={(e) => setFormData({ ...formData, street1: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="street2">Street Address Line 2</Label>
            <Input
              id="street2"
              placeholder="Apartment, suite, unit (optional)"
              value={formData.street2}
              onChange={(e) => setFormData({ ...formData, street2: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code *</Label>
              <Input
                id="postal_code"
                placeholder="110001"
                maxLength={6}
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value.replace(/\D/g, '') })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Continue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};