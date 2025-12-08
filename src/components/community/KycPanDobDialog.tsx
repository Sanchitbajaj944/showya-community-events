import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KycPanDobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onComplete: (pan: string, dob: string) => void;
  loading?: boolean;
  initialValues?: {
    pan?: string;
    dob?: string;
  };
}

export const KycPanDobDialog = ({ open, onOpenChange, userId, onComplete, loading, initialValues }: KycPanDobDialogProps) => {
  const [pan, setPan] = useState("");
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill with initial values when dialog opens
  React.useEffect(() => {
    if (open && initialValues) {
      setPan(initialValues.pan || "");
      setDob(initialValues.dob || "");
    }
  }, [open, initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate PAN format (basic validation)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan.toUpperCase())) {
      toast.error("Invalid PAN format. Should be like ABCDE1234F");
      return;
    }

    // Validate DOB (should be at least 18 years old)
    const dobDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - dobDate.getFullYear();
    if (age < 18) {
      toast.error("You must be at least 18 years old");
      return;
    }

    setSaving(true);
    try {
      // Use upsert to handle both insert and update cases
      const { error } = await supabase
        .from("profile_kyc_data")
        .upsert({ 
          user_id: userId,
          pan: pan.toUpperCase(),
          dob: dob
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success("PAN and DOB saved!");
      onComplete(pan.toUpperCase(), dob);
    } catch (error: any) {
      console.error("Error saving PAN and DOB:", error);
      toast.error(error.message || "Failed to save details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>KYC Verification Required</DialogTitle>
          <DialogDescription>
            {initialValues?.pan 
              ? "Your previous PAN and DOB are shown below. Please verify or update them if needed."
              : "Please provide your PAN and Date of Birth for identity verification. This is required by Razorpay for payment processing."
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pan">PAN Number *</Label>
            <Input
              id="pan"
              placeholder="ABCDE1234F"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              maxLength={10}
              required
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">10 characters: 5 letters, 4 numbers, 1 letter</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth *</Label>
            <Input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              required
            />
            <p className="text-xs text-muted-foreground">Must be at least 18 years old</p>
          </div>

          <Button type="submit" className="w-full" disabled={saving || loading}>
            {saving ? "Saving..." : "Continue"}
          </Button>
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