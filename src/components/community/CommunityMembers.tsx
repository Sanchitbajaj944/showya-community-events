import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, UserPlus } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";

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
        profile:profiles!community_members_user_id_fkey(
          display_name,
          name,
          profile_picture_url
        )
      `)
      .eq("community_id", community.id);

    setMembers(data || []);
  };

  const filteredMembers = members.filter(m => {
    const name = m.profile?.display_name || m.profile?.name || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{members.length} members</p>
            </div>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Members
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search members..." 
              className="pl-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>
                {searchQuery ? "No members found" : "No members yet — invite a few artists to join!"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted">
                  <UserAvatar
                    src={member.profile?.profile_picture_url}
                    name={member.profile?.display_name || member.profile?.name || "User"}
                    size="md"
                  />
                  <div className="flex-1">
                    <p className="font-medium">
                      {member.profile?.display_name || member.profile?.name || "User"}
                    </p>
                    {member.role === 'owner' && (
                      <Badge variant="secondary" className="text-xs">Owner</Badge>
                    )}
                  </div>
                  {userRole === 'owner' && member.role !== 'owner' && (
                    <Button variant="ghost" size="sm">Remove</Button>
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
