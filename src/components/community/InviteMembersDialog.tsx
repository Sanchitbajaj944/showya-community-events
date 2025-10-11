import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface InviteMembersDialogProps {
  communityId: string;
}

export const InviteMembersDialog = ({ communityId }: InviteMembersDialogProps) => {
  const [open, setOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchOrCreateInvite();
    }
  }, [open]);

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const fetchOrCreateInvite = async () => {
    setLoading(true);
    try {
      // Check for existing active invite
      const { data: existingInvites } = await supabase
        .from("community_invites")
        .select("*")
        .eq("community_id", communityId)
        .is("expires_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingInvites && existingInvites.length > 0) {
        setInviteCode(existingInvites[0].invite_code);
      } else {
        // Create new invite
        const code = generateInviteCode();
        const { data: user } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from("community_invites")
          .insert({
            community_id: communityId,
            invite_code: code,
            created_by: user.user?.id,
          });

        if (error) throw error;
        setInviteCode(code);
      }
    } catch (error: any) {
      console.error("Error fetching/creating invite:", error);
      toast.error("Failed to generate invite code");
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/community/${communityId}/join?code=${inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Members
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Members to Community</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Invite Code</Label>
            <div className="flex gap-2">
              <Input
                value={inviteCode}
                readOnly
                className="font-mono text-lg"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyInviteLink}
                disabled={loading || !inviteCode}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Share this code with people you want to invite. They can join by entering this code or clicking the invite link.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
