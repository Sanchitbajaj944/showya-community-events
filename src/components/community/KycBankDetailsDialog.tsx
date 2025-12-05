import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface KycBankDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onComplete: (data: {
    accountNumber: string;
    ifsc: string;
    beneficiaryName: string;
  }) => void;
  loading?: boolean;
}

export const KycBankDetailsDialog = ({
  open,
  onOpenChange,
  userId,
  onComplete,
  loading = false,
}: KycBankDetailsDialogProps) => {
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [tncAccepted, setTncAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!accountNumber || !confirmAccountNumber || !ifsc || !beneficiaryName) {
      toast.error("All fields are required");
      return;
    }

    if (accountNumber !== confirmAccountNumber) {
      toast.error("Account numbers don't match");
      return;
    }

    // Validate account number (8-18 digits)
    if (!/^\d{8,18}$/.test(accountNumber)) {
      toast.error("Account number must be 8-18 digits");
      return;
    }

    // Validate IFSC (11 characters: 4 letters, 0 or alphanumeric at 5th, 6 alphanumeric)
    // More lenient: accepts both 0 and O at 5th position as some users confuse them
    if (!/^[A-Z]{4}[0O][A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
      toast.error("Invalid IFSC code format (e.g., SBIN0001234)");
      return;
    }

    // Validate beneficiary name (3-100 chars, letters and spaces)
    if (beneficiaryName.trim().length < 3 || beneficiaryName.trim().length > 100) {
      toast.error("Beneficiary name must be 3-100 characters");
      return;
    }

    if (!tncAccepted) {
      toast.error("Please accept the terms and conditions");
      return;
    }

    setSaving(true);
    try {
      // Note: Bank details are NOT stored in profiles for security
      // They're sent directly to Razorpay and only masked versions are stored
      
      onComplete({
        accountNumber: accountNumber.trim(),
        ifsc: ifsc.toUpperCase().trim(),
        beneficiaryName: beneficiaryName.trim(),
      });
      
      toast.success("Bank details validated!");
    } catch (error: any) {
      console.error("Bank details validation error:", error);
      toast.error(error.message || "Failed to validate bank details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settlement Bank Account</DialogTitle>
          <DialogDescription>
            Enter your bank account details for receiving payouts. This information is securely transmitted to Razorpay.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="beneficiaryName">
              Account Holder Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="beneficiaryName"
              placeholder="As per bank records"
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
              maxLength={100}
              required
            />
            <p className="text-xs text-muted-foreground">
              Must match the name on your bank account
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">
              Bank Account Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="accountNumber"
              type="text"
              inputMode="numeric"
              placeholder="Enter account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              maxLength={18}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmAccountNumber">
              Confirm Account Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="confirmAccountNumber"
              type="text"
              inputMode="numeric"
              placeholder="Re-enter account number"
              value={confirmAccountNumber}
              onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
              maxLength={18}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ifsc">
              IFSC Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ifsc"
              placeholder="e.g., SBIN0001234"
              value={ifsc}
              onChange={(e) => {
                let value = e.target.value.toUpperCase();
                // Auto-correct common mistake: replace letter O with digit 0 at 5th position
                if (value.length >= 5 && value[4] === 'O') {
                  value = value.substring(0, 4) + '0' + value.substring(5);
                }
                setIfsc(value);
              }}
              maxLength={11}
              required
            />
            <p className="text-xs text-muted-foreground">
              11-character code found on your cheque or bank statement
            </p>
          </div>

          <div className="flex items-start space-x-2 pt-2">
            <Checkbox
              id="tnc"
              checked={tncAccepted}
              onCheckedChange={(checked) => setTncAccepted(checked as boolean)}
            />
            <label
              htmlFor="tnc"
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I accept Razorpay's{" "}
              <a
                href="https://razorpay.com/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Terms & Conditions
              </a>{" "}
              and authorize them to process payments on my behalf
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || loading || !tncAccepted}
              className="flex-1"
            >
              {saving || loading ? "Validating..." : "Continue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
