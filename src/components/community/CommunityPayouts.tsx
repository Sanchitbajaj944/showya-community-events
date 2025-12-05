import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertCircle, RefreshCw, DollarSign, Calendar, User, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KycPhoneDialog } from "./KycPhoneDialog";
import { KycAddressDialog } from "./KycAddressDialog";
import { KycPanDobDialog } from "./KycPanDobDialog";
import { KycDocumentsDialog } from "./KycDocumentsDialog";
import { KycBankDetailsDialog } from "./KycBankDetailsDialog";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showAccountMismatch, setShowAccountMismatch] = useState(false);

  // Fetch transaction history
  useEffect(() => {
    fetchTransactions();
  }, [community.id]);

  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      
      // First get all events for this community
      const { data: communityEvents, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('community_id', community.id);

      if (eventsError) throw eventsError;
      
      if (!communityEvents || communityEvents.length === 0) {
        setTransactions([]);
        setTotalEarnings(0);
        setLoadingTransactions(false);
        return;
      }

      const eventIds = communityEvents.map(e => e.id);

      // Fetch all event participants for these events
      const { data: participants, error } = await supabase
        .from('event_participants')
        .select(`
          *,
          event:events(
            id,
            title,
            community_id,
            community_name,
            performer_ticket_price,
            audience_ticket_price,
            event_date
          )
        `)
        .in('event_id', eventIds)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately to avoid join issues
      const userIds = participants?.map((p: any) => p.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, name, display_name')
        .in('user_id', userIds);

      // Create a map of profiles for easy lookup
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Calculate earnings for each transaction
      const transactionsWithEarnings = participants?.map((p: any) => {
        const profile = profileMap.get(p.user_id);
        const ticketPrice = p.role === 'performer' 
          ? p.event.performer_ticket_price 
          : p.event.audience_ticket_price || 0;
        
        const platformFee = (ticketPrice * community.platform_fee_percentage) / 100;
        const ownerEarnings = ticketPrice - platformFee;

        return {
          id: p.id,
          eventTitle: p.event.title,
          eventDate: p.event.event_date,
          participantName: profile?.display_name || profile?.name || 'Anonymous',
          role: p.role,
          ticketPrice,
          platformFee,
          ownerEarnings,
          joinedAt: p.joined_at
        };
      }) || [];

      setTransactions(transactionsWithEarnings);

      // Calculate total earnings
      const total = transactionsWithEarnings.reduce((sum, t) => sum + t.ownerEarnings, 0);
      setTotalEarnings(total);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Reset all KYC collected data and profile
  const resetKycData = async () => {
    // Clear all collected state
    setDocuments(null);
    setBankDetails(null);
    setExistingProfile(null);
    setKycRetryMode(true);
    
    // Clear user KYC data from database (phone, address, pan, dob)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);
      await supabase
        .from("profile_kyc_data")
        .delete()
        .eq("user_id", session.user.id);
    }
  };

  const handleResetKyc = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-kyc', {
        body: { communityId: community.id }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || "KYC has been reset. You can start fresh.");
        setShowAccountMismatch(false);
        setMissingFields([]);
        setRequirementErrors({});
        setDocuments(null);
        setBankDetails(null);
        setExistingProfile(null);
        onRefresh();
      } else {
        throw new Error(data.error || "Failed to reset KYC");
      }
    } catch (error: any) {
      console.error("Error resetting KYC:", error);
      toast.error(error.message || "Failed to reset KYC. Please try again.");
    } finally {
      setResetting(false);
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
        const isConnectionError = checkError.message?.includes('non-2xx') || 
                                  checkError.message?.includes('connection');
        if (isConnectionError) {
          toast.error("Connection error. Please check your internet and try again.");
        } else {
          toast.error("Failed to check KYC status. Please try again.");
        }
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
        // Check if user has KYC data
        const { data: kycData } = await supabase
          .from("profile_kyc_data")
          .select("phone, street1, street2, city, state, postal_code, pan, dob")
          .eq("user_id", session.user.id)
          .single();

        // Store KYC data for pre-filling
        setExistingProfile(kycData);

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
    if (!bankDetails) {
      setBankDetailsDialogOpen(true);
      return;
    }

    setLoading(true);
    try {
      // Prepare request body
      const requestBody: any = { 
        communityId: community.id,
        bankDetails: {
          accountNumber: bankDetails.accountNumber,
          ifsc: bankDetails.ifsc,
          beneficiaryName: bankDetails.beneficiaryName
        }
      };

      // Only include documents if they were provided
      if (documents) {
        const panCardBase64 = await fileToBase64(documents.panCard);
        const addressProofBase64 = await fileToBase64(documents.addressProof);
        
        requestBody.documents = {
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
        };
      }

      const { data, error } = await supabase.functions.invoke('start-kyc', {
        body: requestBody
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

      if (data?.action === 'hosted_onboarding_required') {
        toast.info(data.message || "Bank details must be completed on Razorpay.", { duration: 6000 });
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
        // Extract error message - handle both data.error and edge function error format
        let errorMessage = "Failed to start KYC process";
        let errorField = data?.field;
        
        if (data?.error) {
          errorMessage = data.error;
        } else if (error) {
          // Try to extract actual error from edge function response
          // Edge function errors may contain the response body in error.context
          try {
            if (error.context && typeof error.context === 'object') {
              errorMessage = error.context.error || error.context.message || error.message;
            } else if (error.message && error.message.includes('non-2xx')) {
              // Generic edge function error - provide helpful message
              errorMessage = "Connection error. Please check your internet and try again.";
            } else {
              errorMessage = error.message;
            }
          } catch {
            errorMessage = error.message || "An error occurred";
          }
        }
        
        console.error("KYC Error:", errorMessage, "Field:", errorField, "Raw error:", error);
        
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
          // Generic error - provide helpful message without exposing raw error
          const isConnectionError = errorMessage.toLowerCase().includes('non-2xx') || 
                                    errorMessage.toLowerCase().includes('connection') ||
                                    errorMessage.toLowerCase().includes('network');
          if (isConnectionError) {
            toast.error("Connection error. Please check your internet and try again.");
          } else {
            toast.error("Something went wrong. Please try again or contact support if the issue persists.");
          }
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
        
        // Automatically check status to refresh UI
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for backend processing
        await handleCheckStatus();
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to continue");
      return;
    }
    setUserId(session.user.id);
    setUserPhone(phone);
    setPhoneDialogOpen(false);
    
    // Always go to address dialog next in the flow
    setAddressDialogOpen(true);
  };

  const handleAddressComplete = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to continue");
      return;
    }
    setUserId(session.user.id);
    setAddressDialogOpen(false);
    
    // Always go to PAN/DOB dialog next in the flow
    setPanDobDialogOpen(true);
  };

  const handlePanDobComplete = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to continue");
      return;
    }
    setUserId(session.user.id);
    setPanDobDialogOpen(false);
    
    // Skip documents and go directly to bank details
    setBankDetailsDialogOpen(true);
  };

  const handleDocumentsComplete = async (docs: { panCard: File; addressProof: File }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to continue");
      return;
    }
    setUserId(session.user.id);
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

      // Handle account mismatch (test vs live environment)
      if (data.account_mismatch || data.needs_restart) {
        setShowAccountMismatch(true);
        toast.warning(data.message || "KYC account mismatch. Please reset and restart the KYC process.", { duration: 6000 });
        return;
      }
      
      setShowAccountMismatch(false);

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
      const isConnectionError = error.message?.includes('non-2xx') || 
                                error.message?.includes('connection');
      if (isConnectionError) {
        toast.error("Connection error. Please try again.");
      } else {
        toast.error("Failed to check KYC status. Please try again.");
      }
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
              <strong>🟡 KYC Under Processing</strong>
              <p className="mt-1">Your authentication is being verified by Razorpay. This typically takes 5-10 minutes.</p>
              <p className="mt-1 text-sm">You'll receive a small test transaction once your account is approved.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
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
        // Check if hosted onboarding URL is available
        const razorpayAccount = community.razorpay_accounts?.[0];
        const hasHostedUrl = razorpayAccount?.onboarding_url;
        
        if (hasHostedUrl) {
          return (
            <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-700 dark:text-orange-300">
                <strong>⚠️ Complete Bank Setup on Razorpay</strong>
                <p className="mt-2">Bank details must be completed directly on Razorpay's secure platform.</p>
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm"
                    onClick={() => {
                      window.open(razorpayAccount.onboarding_url, '_blank');
                      toast.info("Complete bank details on Razorpay, then return here and click Refresh.", { duration: 5000 });
                    }}
                  >
                    Complete Bank Setup
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
        }
        
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
              <div className="flex flex-wrap gap-2 mt-3">
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
                    toast.info("Please re-enter all your details from the beginning", { duration: 4000 });
                    setPhoneDialogOpen(true);
                  }}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Start KYC Again"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={resetting}>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset KYC
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset KYC?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete your existing KYC account and clear all saved KYC details. You'll need to re-enter all information from scratch.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetKyc} disabled={resetting}>
                        {resetting ? "Resetting..." : "Yes, Reset KYC"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
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
          {/* Account Mismatch Alert */}
          {showAccountMismatch && (
            <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-700 dark:text-orange-300">
                <strong>⚠️ KYC Account Mismatch</strong>
                <p className="mt-1">Your KYC account was created in a different environment (test vs production). You need to reset and restart the KYC process.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" className="mt-3" disabled={resetting}>
                      <RotateCcw className={`h-4 w-4 mr-1 ${resetting ? 'animate-spin' : ''}`} />
                      {resetting ? "Resetting..." : "Reset & Start Fresh"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset KYC?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete your existing KYC account and clear all saved KYC details. You'll need to re-enter all information from scratch.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetKyc} disabled={resetting}>
                        {resetting ? "Resetting..." : "Yes, Reset KYC"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </AlertDescription>
            </Alert>
          )}
          
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
            <Badge variant="outline" className="text-lg">{community.platform_fee_percentage}%</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Showya retains {community.platform_fee_percentage}% commission on each ticket sale. Remaining {(100 - community.platform_fee_percentage).toFixed(1)}% is transferred to your account.
          </p>
        </CardContent>
      </Card>

      {/* Total Earnings Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Total Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Collection (after platform fees)</p>
              <p className="text-4xl font-bold">₹{totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                From {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchTransactions}
              disabled={loadingTransactions}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingTransactions ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No transactions yet.</p>
              <p className="text-sm mt-2">Earnings will appear here once attendees book your events.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start gap-2">
                        <h4 className="font-medium truncate">{transaction.eventTitle}</h4>
                        <Badge variant={transaction.role === 'performer' ? 'default' : 'secondary'} className="shrink-0">
                          {transaction.role}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="truncate">{transaction.participantName}</span>
                        </div>
                        <span className="hidden sm:inline">•</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(transaction.joinedAt), "MMM dd, yyyy • h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-1 shrink-0">
                      <p className="text-lg font-bold text-green-600">
                        +₹{transaction.ownerEarnings.toFixed(2)}
                      </p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Ticket: ₹{transaction.ticketPrice.toFixed(2)}</p>
                        <p>Fee: -₹{transaction.platformFee.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
