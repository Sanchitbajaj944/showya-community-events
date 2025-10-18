import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertCircle, RefreshCw, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KycPhoneDialog } from "./KycPhoneDialog";
import { KycAddressDialog } from "./KycAddressDialog";
import { KycPanDobDialog } from "./KycPanDobDialog";
import { KycDocumentsDialog } from "./KycDocumentsDialog";
import { KycBankDetailsDialog } from "./KycBankDetailsDialog";

interface CommunityPayoutsProps {
  community: any;
  onRefresh: () => void;
}

export const CommunityPayouts = ({ community, onRefresh }: CommunityPayoutsProps) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [panDobDialogOpen, setPanDobDialogOpen] = useState(false);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [bankDetailsDialogOpen, setBankDetailsDialogOpen] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [documents, setDocuments] = useState<{ panCard: File; addressProof: File } | null>(null);
  const [bankDetails, setBankDetails] = useState<{ accountNumber: string; ifsc: string; beneficiaryName: string } | null>(null);
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [kycRetryMode, setKycRetryMode] = useState(false);

  const handleStartKyc = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
      }

      setUserId(session.user.id);

      // Check if user has complete profile information
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, street1, street2, city, state, postal_code, pan, dob")
        .eq("user_id", session.user.id)
        .single();

      // Store profile for pre-filling
      setExistingProfile(profile);

      // Check for phone number first
      if (!profile?.phone || profile.phone.trim() === '') {
        setPhoneDialogOpen(true);
        return;
      }

      // Check for address information
      if (!profile?.street1 || !profile?.city || !profile?.state || !profile?.postal_code) {
        setAddressDialogOpen(true);
        return;
      }

      // Check for PAN and DOB
      if (!profile?.pan || !profile?.dob) {
        setPanDobDialogOpen(true);
        return;
      }

      // If all profile info is complete but no documents yet, show document upload
      if (!documents) {
        setDocumentsDialogOpen(true);
        return;
      }

      // If documents are collected but no bank details, show bank dialog
      if (!bankDetails) {
        setBankDetailsDialogOpen(true);
        return;
      }

      setUserPhone(profile.phone);
      await initiateKyc();
    } catch (error: any) {
      console.error("Error starting KYC:", error);
      toast.error(error.message || "Failed to start KYC process");
    }
  };

  const initiateKyc = async () => {
    if (!documents) {
      setDocumentsDialogOpen(true);
      return;
    }

    if (!bankDetails) {
      setBankDetailsDialogOpen(true);
      return;
    }

    setLoading(true);
    try {
      // Convert files to base64 for edge function
      const panCardBase64 = await fileToBase64(documents.panCard);
      const addressProofBase64 = await fileToBase64(documents.addressProof);

      const { data, error } = await supabase.functions.invoke('start-kyc', {
        body: { 
          communityId: community.id,
          documents: {
            panCard: {
              name: documents.panCard.name,
              type: documents.panCard.type,
              data: panCardBase64
            },
            addressProof: {
              name: documents.addressProof.name,
              type: documents.addressProof.type,
              data: addressProofBase64
            }
          },
          bankDetails: {
            accountNumber: bankDetails.accountNumber,
            ifsc: bankDetails.ifsc,
            beneficiaryName: bankDetails.beneficiaryName
          }
        }
      });

      // Handle special actions from backend
      if (data?.action === 'reenter_details') {
        setKycRetryMode(true);
        toast.error(data.message, { duration: 6000 });
        // Show phone dialog to start re-entry flow
        setPhoneDialogOpen(true);
        return;
      }

      if (data?.action === 'wait') {
        toast.info(data.message, { duration: 5000 });
        // If there's an onboarding URL, allow user to continue
        if (data.onboarding_url) {
          window.location.href = data.onboarding_url;
        }
        return;
      }

      // Handle error response from edge function
      if (error || (data && data.error)) {
        const errorMessage = data?.error || error?.message || "Failed to start KYC process";
        const errorField = data?.field;
        
        console.error("KYC Error:", errorMessage, "Field:", errorField);
        
        // Check if it's a street length validation error from Razorpay
        const isStreetLengthError = errorMessage.toLowerCase().includes('street must be between 10 and 255') ||
                                    errorMessage.toLowerCase().includes('address must be at least 10 characters');
        
        // Parse error to determine which field failed and reopen relevant dialog
        const phoneFields = ['phone'];
        const addressFields = ['street', 'street1', 'street2', 'city', 'state', 'postal_code', 'address'];
        const panDobFields = ['pan', 'dob'];
        
        if (errorField && phoneFields.includes(errorField)) {
          toast.error(`Phone number issue: ${errorMessage}. Please re-enter.`);
          setPhoneDialogOpen(true);
        } else if (isStreetLengthError || (errorField && addressFields.includes(errorField))) {
          if (isStreetLengthError) {
            toast.error("Please enter a more complete address including area or landmark.", { duration: 5000 });
          } else {
            toast.error(`Address issue: ${errorMessage}. Please re-enter.`);
          }
          setAddressDialogOpen(true);
        } else if (errorField && panDobFields.includes(errorField)) {
          toast.error(`PAN/DOB issue: ${errorMessage}. Please re-enter.`);
          setPanDobDialogOpen(true);
        } else if (errorMessage.toLowerCase().includes('phone')) {
          toast.error("Phone validation failed. Please re-enter your phone number.");
          setPhoneDialogOpen(true);
        } else if (errorMessage.toLowerCase().includes('address') || errorMessage.toLowerCase().includes('street') || errorMessage.toLowerCase().includes('city') || errorMessage.toLowerCase().includes('state') || errorMessage.toLowerCase().includes('postal')) {
          toast.error("Address validation failed. Please re-enter your address.");
          setAddressDialogOpen(true);
        } else if (errorMessage.toLowerCase().includes('pan') || errorMessage.toLowerCase().includes('dob')) {
          toast.error("PAN/DOB validation failed. Please re-enter your details.");
          setPanDobDialogOpen(true);
        } else if (errorMessage.toLowerCase().includes('name')) {
          toast.error("Name validation failed. Please verify your profile.");
          setPhoneDialogOpen(true);
        } else {
          // Generic validation error - prompt to re-enter all details
          toast.error(`Validation failed: ${errorMessage}. Please re-enter your details.`);
          setPhoneDialogOpen(true);
        }
        return;
      }

      // If we have an onboarding URL, redirect to it (works in both test and live mode)
      if (data.onboarding_url) {
        // Use window.location.href for reliable redirect (popup blockers won't interfere)
        window.location.href = data.onboarding_url;
      } 
      // KYC already complete
      else if (data.kyc_status === 'ACTIVATED' || data.kyc_status === 'APPROVED') {
        toast.success("KYC already activated!");
        onRefresh();
      } 
      // No onboarding URL available (rare case)
      else {
        toast.error("Onboarding link unavailable. Check server logs.");
        console.error('Start KYC response:', data);
        onRefresh();
      }
    } catch (error: any) {
      console.error("Unexpected error starting KYC:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setPhoneDialogOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handlePhoneSubmit = async (phone: string) => {
    setUserPhone(phone);
    setPhoneDialogOpen(false);
    
    // After phone is saved, check for address
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("street1, city, state, postal_code, pan, dob")
      .eq("user_id", session.user.id)
      .single();

    if (!profile?.street1 || !profile?.city || !profile?.state || !profile?.postal_code) {
      setAddressDialogOpen(true);
    } else if (!profile?.pan || !profile?.dob) {
      setPanDobDialogOpen(true);
    } else if (!documents) {
      setDocumentsDialogOpen(true);
    } else {
      await initiateKyc();
    }
  };

  const handleAddressComplete = async () => {
    setAddressDialogOpen(false);
    
    // Check for PAN and DOB next
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("pan, dob")
      .eq("user_id", session.user.id)
      .single();

    if (!profile?.pan || !profile?.dob) {
      setPanDobDialogOpen(true);
    } else if (!documents) {
      setDocumentsDialogOpen(true);
    } else if (!bankDetails) {
      setBankDetailsDialogOpen(true);
    } else {
      await initiateKyc();
    }
  };

  const handlePanDobComplete = async (pan: string, dob: string) => {
    setPanDobDialogOpen(false);
    
    // After PAN/DOB, check for documents
    if (!documents) {
      setDocumentsDialogOpen(true);
    } else if (!bankDetails) {
      setBankDetailsDialogOpen(true);
    } else {
      await initiateKyc();
    }
  };

  const handleDocumentsComplete = async (docs: { panCard: File; addressProof: File }) => {
    setDocuments(docs);
    setDocumentsDialogOpen(false);
    
    // After documents, check for bank details
    if (!bankDetails) {
      toast.success("Documents uploaded! Now let's add your bank details.");
      setBankDetailsDialogOpen(true);
    } else {
      toast.success("Documents uploaded! Starting KYC process...");
      setTimeout(() => {
        handleStartKyc();
      }, 500);
    }
  };

  const handleBankDetailsComplete = async (data: { accountNumber: string; ifsc: string; beneficiaryName: string }) => {
    setBankDetails(data);
    setBankDetailsDialogOpen(false);
    
    toast.success("Bank details saved! Starting KYC verification...");
    
    // Delay slightly to allow state to update
    setTimeout(() => {
      handleStartKyc();
    }, 500);
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-kyc-status');

      if (error) throw error;

      toast.success("Status updated!");
      onRefresh();
    } catch (error: any) {
      console.error("Error checking KYC status:", error);
      toast.error(error.message || "Failed to check KYC status");
    } finally {
      setChecking(false);
    }
  };

  const getKycCard = (status: string) => {
    switch (status) {
      case 'ACTIVATED':
      case 'APPROVED':
        return (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              <strong>🟢 KYC Verified</strong>
              <p className="mt-1">Your KYC is approved. Ticket sales will auto-settle to your bank account.</p>
            </AlertDescription>
          </Alert>
        );
      
      case 'VERIFIED':
        return (
          <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <strong>Verified — Activating Soon</strong>
              <p className="mt-1">Your details are verified. Activation typically takes 1 business day.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={handleCheckStatus}
                disabled={checking}
              >
                {checking ? "Checking..." : "Refresh Status"}
              </Button>
            </AlertDescription>
          </Alert>
        );
      
      case 'PENDING':
      case 'IN_PROGRESS':
        return (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <Clock className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              <strong>🟡 Pending Review</strong>
              <p className="mt-1">Your KYC is currently under review. You'll be notified once verified.</p>
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  onClick={handleStartKyc}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Complete KYC on Razorpay"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCheckStatus}
                  disabled={checking}
                >
                  {checking ? "Checking..." : "Refresh"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        );
      
      case 'NEEDS_INFO':
        return (
          <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              <strong>Action Needed — More Details Required</strong>
              <p className="mt-1">Razorpay needs additional information to complete your KYC.</p>
              <Button 
                size="sm" 
                className="mt-2"
                onClick={handleStartKyc}
                disabled={loading}
              >
                {loading ? "Loading..." : "Complete on Razorpay"}
              </Button>
            </AlertDescription>
          </Alert>
        );
      
      case 'FAILED':
      case 'REJECTED':
        return (
          <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
            <XCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              <strong>🔴 Verification Failed</strong>
              <p className="mt-1">Your previous KYC attempt couldn't be verified. Please review your details and try again.</p>
              <p className="mt-2 text-sm">Make sure your PAN and address match your government records.</p>
              <Button 
                size="sm" 
                className="mt-3"
                onClick={handleStartKyc}
                disabled={loading}
              >
                {loading ? "Loading..." : "Re-enter Details"}
              </Button>
            </AlertDescription>
          </Alert>
        );
      
      default:
        return (
          <Alert className="border-primary bg-primary/5">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription>
              <strong>Start Your KYC to Enable Payouts</strong>
              <p className="mt-1 text-muted-foreground">
                Verify your identity on Razorpay's secure platform to start accepting payments for paid events.
              </p>
              <div className="flex gap-2 mt-3">
                <Button 
                  size="sm" 
                  onClick={handleStartKyc}
                  disabled={loading}
                >
                  {loading ? "Starting..." : "Start KYC"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open('https://razorpay.com/docs/partners/route/onboarding/', '_blank')}
                >
                  Learn More
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        );
    }
  };

  return (
    <div className="space-y-6">
      <KycPhoneDialog
        open={phoneDialogOpen}
        onOpenChange={setPhoneDialogOpen}
        onPhoneSubmit={handlePhoneSubmit}
        loading={loading}
        initialValue={existingProfile?.phone}
      />
      
      <KycAddressDialog
        open={addressDialogOpen}
        onOpenChange={setAddressDialogOpen}
        userId={userId}
        onComplete={handleAddressComplete}
        initialValues={existingProfile ? {
          street1: existingProfile.street1,
          street2: existingProfile.street2,
          city: existingProfile.city,
          state: existingProfile.state,
          postal_code: existingProfile.postal_code
        } : undefined}
      />

      <KycPanDobDialog
        open={panDobDialogOpen}
        onOpenChange={setPanDobDialogOpen}
        userId={userId}
        onComplete={handlePanDobComplete}
        loading={loading}
        initialValues={existingProfile ? {
          pan: existingProfile.pan,
          dob: existingProfile.dob
        } : undefined}
      />

      <KycDocumentsDialog
        open={documentsDialogOpen}
        onOpenChange={setDocumentsDialogOpen}
        onComplete={handleDocumentsComplete}
        loading={loading}
      />

      <KycBankDetailsDialog
        open={bankDetailsDialogOpen}
        onOpenChange={setBankDetailsDialogOpen}
        userId={userId}
        onComplete={handleBankDetailsComplete}
        loading={loading}
      />
      
      {/* KYC Status */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {getKycCard(community.kyc_status)}
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleCheckStatus}
            disabled={checking}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            {checking ? "Checking..." : "Refresh Status"}
          </Button>
        </CardContent>
      </Card>

      {/* Commission Info */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Platform Fee</p>
              <p className="text-sm text-muted-foreground">Per ticket sale</p>
            </div>
            <Badge variant="outline" className="text-lg">5%</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Showya retains 5% commission on each ticket sale. Remaining 95% is transferred to your account.
          </p>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Set up payouts to start earning from your events.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
