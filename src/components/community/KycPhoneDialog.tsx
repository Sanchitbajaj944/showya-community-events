import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface KycPhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPhoneSubmit: (phone: string) => void;
  loading?: boolean;
  initialValue?: string;
}

export const KycPhoneDialog = ({ open, onOpenChange, onPhoneSubmit, loading, initialValue }: KycPhoneDialogProps) => {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill with initial value when dialog opens
  React.useEffect(() => {
    if (open && initialValue) {
      // Remove country code for display
      const displayPhone = initialValue.replace(/^\+91/, '');
      setPhone(displayPhone);
    }
  }, [open, initialValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number (basic validation)
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    // Format phone number to include country code if not present
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+91${formattedPhone}`; // Default to India
    }

    setSaving(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update phone in profile_kyc_data table (upsert to handle both insert and update)
      const { error: updateError } = await supabase
        .from("profile_kyc_data")
        .upsert({ 
          user_id: user.id,
          phone: formattedPhone 
        }, {
          onConflict: 'user_id'
        });

      if (updateError) throw updateError;

      toast.success("Phone number saved!");
      onPhoneSubmit(formattedPhone);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving phone:", error);
      toast.error(error.message || "Failed to save phone number");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Phone Number Required</DialogTitle>
          <DialogDescription>
            {initialValue 
              ? "Your previous phone number is shown below. Please verify or update it if needed."
              : "Razorpay requires a phone number for KYC verification. Please provide your phone number to continue."
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="pl-9"
                maxLength={10}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter 10-digit mobile number (country code will be added automatically)
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={saving || loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving || loading || phone.length < 10}
            >
              {saving ? "Saving..." : "Continue"}
            </Button>
          </div>
        </form>
        
        <div className="flex items-center justify-center gap-2 pt-2 border-t border-border mt-2">
          <span className="text-xs text-muted-foreground">Powered by</span>
          <img 
            src="https://razorpay.com/assets/razorpay-glyph.svg" 
            alt="Razorpay" 
            className="h-4 w-auto"
          />
          <span className="text-xs font-medium text-muted-foreground">Razorpay</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};