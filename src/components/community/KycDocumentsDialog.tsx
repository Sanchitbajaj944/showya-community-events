import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface KycDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (documents: { panCard: File; addressProof: File }) => void;
  loading?: boolean;
}

export const KycDocumentsDialog = ({ open, onOpenChange, onComplete, loading }: KycDocumentsDialogProps) => {
  const [panCard, setPanCard] = useState<File | null>(null);
  const [addressProof, setAddressProof] = useState<File | null>(null);

  const handlePanCardUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error("Only JPG, PNG, or PDF files are allowed");
        return;
      }
      setPanCard(file);
    }
  };

  const handleAddressProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error("Only JPG, PNG, or PDF files are allowed");
        return;
      }
      setAddressProof(file);
    }
  };

  const handleSubmit = () => {
    if (!panCard) {
      toast.error("Please upload your PAN card");
      return;
    }
    if (!addressProof) {
      toast.error("Please upload address proof");
      return;
    }
    onComplete({ panCard, addressProof });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload KYC Documents</DialogTitle>
          <DialogDescription>
            Please upload clear images or PDFs of your documents. Maximum file size: 5MB per document.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* PAN Card Upload */}
          <div className="space-y-2">
            <Label>PAN Card *</Label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={handlePanCardUpload}
                className="hidden"
                id="pan-card-upload"
              />
              <Label
                htmlFor="pan-card-upload"
                className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent flex-1"
              >
                <Upload className="h-4 w-4" />
                {panCard ? "Change File" : "Choose File"}
              </Label>
              {panCard && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">{panCard.name}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Upload a clear photo or scan of your PAN card</p>
          </div>

          {/* Address Proof Upload */}
          <div className="space-y-2">
            <Label>Address Proof *</Label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={handleAddressProofUpload}
                className="hidden"
                id="address-proof-upload"
              />
              <Label
                htmlFor="address-proof-upload"
                className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent flex-1"
              >
                <Upload className="h-4 w-4" />
                {addressProof ? "Change File" : "Choose File"}
              </Label>
              {addressProof && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">{addressProof.name}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Accepted: Aadhaar card, Voter ID, Driving License, Passport (must match registered address)
            </p>
          </div>

          <Button 
            onClick={handleSubmit} 
            className="w-full" 
            disabled={loading || !panCard || !addressProof}
          >
            {loading ? "Processing..." : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};