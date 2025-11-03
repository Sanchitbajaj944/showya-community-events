import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetType: "user" | "community_owner";
  contextType?: "event" | "chat" | "profile" | "community";
  contextId?: string;
  targetName?: string;
}

const USER_REPORT_REASONS = [
  "Spam / Scam",
  "Harassment or Hate Speech",
  "Inappropriate Content or Behavior",
  "Fake Identity or Misrepresentation",
  "Disruption during an event",
];

const COMMUNITY_OWNER_REPORT_REASONS = [
  "No events hosted / abandoned community",
  "Fraudulent or misleading event info",
  "Unfulfilled promises (no links shared, fake ticketing)",
  "Abusive or biased moderation",
  "Inappropriate use of attendee data",
];

export const ReportDialog = ({
  open,
  onOpenChange,
  targetUserId,
  targetType,
  contextType,
  contextId,
  targetName,
}: ReportDialogProps) => {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const reasons = targetType === "user" ? USER_REPORT_REASONS : COMMUNITY_OWNER_REPORT_REASONS;

  const handleSubmit = async () => {
    if (!reason) {
      toast({
        title: "Please select a reason",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to report",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("reports")
        .insert([
          {
            reporter_id: user.id,
            target_user_id: targetUserId,
            target_type: targetType,
            reason,
            message: message.trim() || null,
            context_type: contextType || null,
            context_id: contextId || null,
          },
        ]);

      if (error) {
        // Check if it's a rate limit error
        if (error.message.includes("24 hours")) {
          toast({
            title: "Report already submitted",
            description: "You've already reported this user in the last 24 hours.",
            variant: "destructive",
          });
        } else if (error.message.includes("no_self_report")) {
          toast({
            title: "Cannot report yourself",
            description: "You cannot submit a report about your own account.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Report submitted",
          description: "Thanks for helping keep Showya safe. We'll review this shortly.",
        });
        onOpenChange(false);
        setReason("");
        setMessage("");
      }
    } catch (error: any) {
      console.error("Error submitting report:", error);
      toast({
        title: "Failed to submit report",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Report {targetType === "user" ? "User" : "Community Owner"}
          </DialogTitle>
          <DialogDescription>
            {targetName && <span className="font-medium">Reporting: {targetName}</span>}
            <br />
            Please help us understand the issue. All reports are reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for report *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Additional details (optional)</Label>
            <Textarea
              id="message"
              placeholder="Provide any additional context that might help us understand the situation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} variant="destructive">
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
