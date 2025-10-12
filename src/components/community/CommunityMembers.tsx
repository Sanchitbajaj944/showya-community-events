import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { InviteMembersDialog } from "./InviteMembersDialog";
import { toast } from "sonner";

interface CommunityMembersProps {
  community: any;
  userRole: 'owner' | 'member' | 'public';
}

export const CommunityMembers = ({ community, userRole }: CommunityMembersProps) => {
  const [members, setMembers] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    fetchMembers();
  }, [community.id]);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("community_members")
      .select(`
        *,
        profile:profiles_public!community_members_user_id_fkey(
          display_name,
          name,
          profile_picture_url
        )
      `)
      .eq("community_id", community.id);

    setMembers(data || []);
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Member removed");
      fetchMembers();
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
    }
  };

  const filteredMembers = members.filter(m => {
    const name = m.profile?.display_name || m.profile?.name || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div>
              <CardTitle className="text-lg sm:text-xl">Members</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{members.length} members</p>
            </div>
            {userRole === 'owner' && (
              <InviteMembersDialog communityId={community.id} />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 sm:top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search members..." 
              className="pl-9 text-sm sm:text-base h-9 sm:h-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
              <p className="text-sm sm:text-base px-4">
                {searchQuery ? "No members found" : "No members yet — invite a few artists to join!"}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {filteredMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover:bg-muted">
                  <UserAvatar
                    src={member.profile?.profile_picture_url}
                    name={member.profile?.display_name || member.profile?.name || "User"}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">
                      {member.profile?.display_name || member.profile?.name || "User"}
                    </p>
                    {member.role === 'owner' && (
                      <Badge variant="secondary" className="text-xs">Owner</Badge>
                    )}
                  </div>
                  {userRole === 'owner' && member.role !== 'owner' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs sm:text-sm h-8 px-2 sm:px-3"
                      onClick={() => handleRemoveMember(member.id, member.user_id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
