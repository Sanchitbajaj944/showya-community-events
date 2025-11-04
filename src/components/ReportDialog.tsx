import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { reportSchema, type ReportFormData, USER_INCIDENT_LOCATIONS, COMMUNITY_OWNER_INCIDENT_LOCATIONS } from "@/lib/validations/report";

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
  const { toast } = useToast();

  const reasons = targetType === "user" ? USER_REPORT_REASONS : COMMUNITY_OWNER_REPORT_REASONS;
  const incidentLocations = targetType === "user" ? USER_INCIDENT_LOCATIONS : COMMUNITY_OWNER_INCIDENT_LOCATIONS;

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reason: "",
      incident_location: "",
      message: "",
    },
  });

  const handleSubmit = async (data: ReportFormData) => {
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
            reason: data.reason,
            message: data.message,
            incident_location: data.incident_location,
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
        form.reset();
      }
    } catch (error: any) {
      console.error("Error submitting report:", error);
      toast({
        title: "Failed to submit report",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Report {targetType === "user" ? "User" : "Community Owner"}
          </DialogTitle>
          <DialogDescription>
            {targetName && <span className="font-medium">Reporting: {targetName}</span>}
            <br />
            Please provide detailed information about this incident. All fields are required and will be reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for report *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {reasons.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="incident_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Where did this happen? *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {incidentLocations.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detailed description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please describe what happened in detail (minimum 50 characters)..."
                      rows={5}
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between items-center">
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">{field.value?.length || 0}/500</p>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }} 
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting} variant="destructive">
                {form.formState.isSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
