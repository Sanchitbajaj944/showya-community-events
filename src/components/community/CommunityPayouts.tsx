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
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [requirementErrors, setRequirementErrors] = useState<any>({});

  // Reset all KYC collected data and profile
  const resetKycData = async () => {
    // Clear all collected state
    setDocuments(null);
    setBankDetails(null);
    setExistingProfile(null);
    setKycRetryMode(true);
    
    // Clear user profile data from database (phone, address, pan, dob)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase
        .from("profiles")
        .update({
          phone: null,
          street1: null,
          street2: null,
          city: null,
          state: null,
          postal_code: null,
          pan: null,
          dob: null
        })
        .eq("user_id", session.user.id);
    }
  };

  const handleStartKyc = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
      }

      setUserId(session.user.id);
      setChecking(true);

      // First, check if an account already exists in backend
      const { data: checkResult, error: checkError } = await supabase.functions.invoke(
        "start-kyc",
        {
          body: { 
            communityId: community.id,
            checkOnly: true 
          }
        }
      );

      setChecking(false);

      if (checkError) {
        console.error("Error checking KYC status:", checkError);
        toast.error("Failed to check KYC status");
        return;
      }

      // Handle different responses from backend check
      if (checkResult.success) {
        // Already activated
        toast.success(checkResult.message);
        onRefresh();
        return;
      }

      if (checkResult.action === 'wait') {
        // Already under review - show in UI, no dashboard redirect
        toast.info(checkResult.message);
        onRefresh();
        return;
      }

      if (checkResult.action === 'proceed') {
        // No existing account or IN_PROGRESS - proceed with forms
        // Check if user has complete profile information
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone, street1, street2, city, state, postal_code, pan, dob")
          .eq("user_id", session.user.id)
          .single();

        // Store profile for pre-filling
        setExistingProfile(profile);

        // Start from phone dialog
        setPhoneDialogOpen(true);
        return;
      }

      // Default: start the flow
      setPhoneDialogOpen(true);
    } catch (error: any) {
      setChecking(false);
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
        toast.error(data.message, { duration: 6000 });
        // Reset all collected data and start fresh
        await resetKycData();
        // Show phone dialog to start re-entry flow from scratch
        setPhoneDialogOpen(true);
        return;
      }

      if (data?.action === 'wait') {
        toast.info(data.message, { duration: 5000 });
        onRefresh();
        return;
      }

      if (data?.action === 'manual_setup') {
        console.log('Manual setup required, checking what is missing...');
        
        // Check current status to see what's missing
        const { data: statusData, error: statusError } = await supabase.functions.invoke('check-kyc-status');
        
        if (!statusError && statusData && statusData.missing_fields) {
          const missing = statusData.missing_fields;
          console.log('Missing fields:', missing);
          
          // Store missing fields for later use
          setMissingFields(missing);
          if (statusData.requirement_errors) {
            setRequirementErrors(statusData.requirement_errors);
          }
          
          toast.info("Additional Information Required: Please complete the remaining KYC details.");
          
          // Navigate to the appropriate dialog based on missing fields
          if (missing.some((f: string) => f.includes('phone') || f.includes('contact'))) {
            setPhoneDialogOpen(true);
          } else if (missing.some((f: string) => f.includes('address') || f.includes('street') || f.includes('city') || f.includes('state') || f.includes('postal'))) {
            setAddressDialogOpen(true);
          } else if (missing.some((f: string) => f.includes('pan') || f.includes('legal_info') || f.includes('kyc.pan'))) {
            setPanDobDialogOpen(true);
          } else if (missing.some((f: string) => f.includes('document') || f.includes('proof'))) {
            setDocumentsDialogOpen(true);
          } else if (missing.some((f: string) => f.includes('bank') || f.includes('settlement'))) {
            setBankDetailsDialogOpen(true);
          } else {
            // If no specific field is identified but manual setup is required,
            // start from the first dialog to recollect all information
            setPhoneDialogOpen(true);
          }
        } else {
          // Fallback: show onboarding URL if we can't determine what's missing
          toast.warning("Manual Setup Required: Please complete KYC on Razorpay dashboard.");
          
          if (data.onboarding_url) {
            setTimeout(() => {
              window.open(data.onboarding_url, '_blank');
            }, 2000);
          }
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

      // Embedded onboarding - no dashboard redirects
      if (data.success) {
        if (data.kyc_status === 'ACTIVATED') {
          toast.success("KYC approved! Payouts enabled.");
        } else if (data.kyc_status === 'PENDING') {
          toast.info("Your details are under review. You'll be notified once verified.", { duration: 5000 });
        } else {
          toast.success(data.message || "KYC submitted successfully");
        }
        onRefresh();
      } else {
        toast.error("KYC submission failed. Please try again.");
        console.error('Start KYC response:', data);
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
    
    // Always go to address dialog next in the flow
    setAddressDialogOpen(true);
  };

  const handleAddressComplete = async () => {
    setAddressDialogOpen(false);
    
    // Always go to PAN/DOB dialog next in the flow
    setPanDobDialogOpen(true);
  };

  const handlePanDobComplete = async () => {
    setPanDobDialogOpen(false);
    
    // Always go to documents dialog next in the flow
    setDocumentsDialogOpen(true);
  };

  const handleDocumentsComplete = async (docs: { panCard: File; addressProof: File }) => {
    setDocuments(docs);
    setDocumentsDialogOpen(false);
    
    // Always go to bank details dialog next in the flow
    setBankDetailsDialogOpen(true);
  };

  const handleBankDetailsComplete = async (details: { accountNumber: string; ifsc: string; beneficiaryName: string }) => {
    setBankDetails(details);
    setBankDetailsDialogOpen(false);
    
    // Determine if we're updating existing KYC or starting new
    const isUpdating = community.kyc_status === 'NEEDS_INFO' || kycRetryMode;
    
    if (isUpdating) {
      await updateKycData();
    } else {
      await initiateKyc();
    }
  };

  const updateKycData = async () => {
    if (!documents || !bankDetails) {
      toast.error("Missing required information");
      return;
    }

    setLoading(true);
    try {
      // Convert files to base64
      const panCardBase64 = await fileToBase64(documents.panCard);
      const addressProofBase64 = await fileToBase64(documents.addressProof);

      // Update documents if needed
      if (missingFields.some(f => f.includes('proof_of_identification') || f.includes('proof_of_address'))) {
        await supabase.functions.invoke('update-kyc', {
          body: {
            communityId: community.id,
            updateType: 'documents',
            data: {
              panCard: {
                name: documents.panCard.name,
                base64: panCardBase64
              },
              addressProof: {
                name: documents.addressProof.name,
                base64: addressProofBase64
              }
            }
          }
        });
      }

      // Update bank details if needed
      if (missingFields.includes('bank_account_verification') || requirementErrors?.bank_account) {
        await supabase.functions.invoke('update-kyc', {
          body: {
            communityId: community.id,
            updateType: 'bank',
            data: {
              account_number: bankDetails.accountNumber,
              ifsc: bankDetails.ifsc,
              beneficiary_name: bankDetails.beneficiaryName
            }
          }
        });
      }

      // Update address if needed
      const hasAddressIssue = missingFields.some(f => 
        f.includes('address') || f.includes('street') || f.includes('city') || 
        f.includes('state') || f.includes('postal')
      );
      
      if (hasAddressIssue && existingProfile) {
        await supabase.functions.invoke('update-kyc', {
          body: {
            communityId: community.id,
            updateType: 'address',
            data: {
              street1: existingProfile.street1,
              street2: existingProfile.street2,
              city: existingProfile.city,
              state: existingProfile.state,
              postal_code: existingProfile.postal_code
            }
          }
        });
      }

      toast.success("KYC details updated successfully! Verification will continue.");
      setKycRetryMode(false);
      onRefresh();
    } catch (error: any) {
      console.error("Error updating KYC:", error);
      toast.error(error.message || "Failed to update KYC details");
    } finally {
      setLoading(false);
    }
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

      // Store missing fields and errors for display
      if (data.missing_fields) {
        setMissingFields(data.missing_fields);
      }
      if (data.requirement_errors) {
        setRequirementErrors(data.requirement_errors);
      }

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
              <strong>🟡 Verification in Progress</strong>
              <p className="mt-1">Your KYC details are being reviewed. This typically takes 1-2 business days.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={handleCheckStatus}
                disabled={checking}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                {checking ? "Checking..." : "Refresh Status"}
              </Button>
            </AlertDescription>
          </Alert>
        );
      
      case 'NEEDS_INFO':
        const getMissingFieldsMessage = () => {
          if (!missingFields || missingFields.length === 0) {
            return "Some details need to be updated. Please re-submit your KYC.";
          }
          
          const fieldMessages: string[] = [];
          const hasAddressProof = missingFields.includes('individual_proof_of_address');
          const hasPanProof = missingFields.includes('individual_proof_of_identification');
          const hasBankIssue = missingFields.includes('bank_account_verification') || 
                               requirementErrors?.bank_account;
          const hasAddressFields = missingFields.some(f => 
            f.includes('address') || f.includes('street') || f.includes('city') || 
            f.includes('state') || f.includes('postal')
          );
          
          if (hasPanProof) fieldMessages.push("• PAN card document");
          if (hasAddressProof) fieldMessages.push("• Address proof document");
          if (hasBankIssue) {
            const bankError = requirementErrors?.bank_account?.[0];
            fieldMessages.push(`• Bank details${bankError ? ` (${bankError})` : ''}`);
          }
          if (hasAddressFields) fieldMessages.push("• Address information");
          
          if (fieldMessages.length === 0) {
            return "Some details need verification. Please review and re-submit.";
          }
          
          return (
            <div>
              <p className="mb-2">The following need to be updated:</p>
              <ul className="text-sm space-y-1">
                {fieldMessages.map((msg, i) => <li key={i}>{msg}</li>)}
              </ul>
            </div>
          );
        };
        
        return (
          <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              <strong>⚠️ Additional Information Required</strong>
              <div className="mt-2">{getMissingFieldsMessage()}</div>
              <div className="flex gap-2 mt-3">
                <Button 
                  size="sm"
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      toast.error("Please sign in to continue");
                      return;
                    }
                    setUserId(session.user.id);
                    await resetKycData();
                    setPhoneDialogOpen(true);
                  }}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Update Details"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCheckStatus}
                  disabled={checking}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? "Checking..." : "Refresh"}
                </Button>
              </div>
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
              <p className="mt-1">Your previous KYC attempt couldn't be verified. Please review all your details and try again.</p>
              <p className="mt-2 text-sm">Make sure your PAN and address match your government records.</p>
              <Button 
                size="sm" 
                className="mt-3"
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    toast.error("Please sign in to continue");
                    return;
                  }
                  setUserId(session.user.id);
                  await resetKycData();
                  toast.info("Please re-enter all your details from the beginning", { duration: 4000 });
                  setPhoneDialogOpen(true);
                }}
                disabled={loading}
              >
                {loading ? "Loading..." : "Start KYC Again"}
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
