import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertCircle, RefreshCw, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KycPhoneDialog } from "./KycPhoneDialog";

interface CommunityPayoutsProps {
  community: any;
  onRefresh: () => void;
}

export const CommunityPayouts = ({ community, onRefresh }: CommunityPayoutsProps) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("");

  const handleStartKyc = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
      }

      // Check if user has a phone number in profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.phone || profile.phone.trim() === '') {
        setPhoneDialogOpen(true);
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
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('start-kyc', {
        body: { communityId: community.id }
      });

      if (error) throw error;

      if (data.onboarding_url) {
        toast.success("Redirecting to KYC onboarding...");
        window.open(data.onboarding_url, '_blank');
        
        // Refresh after a short delay
        setTimeout(() => {
          onRefresh();
        }, 2000);
      } else if (data.kyc_status === 'APPROVED') {
        toast.success("KYC already approved!");
        onRefresh();
      }
    } catch (error: any) {
      console.error("Error starting KYC:", error);
      toast.error(error.message || "Failed to start KYC process");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (phone: string) => {
    setUserPhone(phone);
    await initiateKyc();
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
      case 'APPROVED':
        return (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              <strong>Payouts Active</strong>
              <p className="mt-1">Ticket sales auto-settle to your bank account.</p>
            </AlertDescription>
          </Alert>
        );
      
      case 'IN_PROGRESS':
        return (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <Clock className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              <strong>KYC In Progress</strong>
              <p className="mt-1">We're verifying your details. This usually takes 1-2 business days.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={handleStartKyc}
                disabled={loading}
              >
                {loading ? "Loading..." : "Resume KYC"}
              </Button>
            </AlertDescription>
          </Alert>
        );
      
      case 'REJECTED':
        return (
          <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
            <XCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              <strong>KYC Needs Action</strong>
              <p className="mt-1">Additional information required. Please retry KYC verification.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={handleStartKyc}
                disabled={loading}
              >
                {loading ? "Loading..." : "Retry KYC"}
              </Button>
            </AlertDescription>
          </Alert>
        );
      
      default:
        return (
          <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              <strong>Complete KYC to Receive Ticket Sales</strong>
              <p className="mt-1">Verify your identity to start accepting payments for paid events.</p>
              <Button 
                size="sm" 
                className="mt-2"
                onClick={handleStartKyc}
                disabled={loading}
              >
                {loading ? "Starting..." : "Start KYC"}
              </Button>
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
