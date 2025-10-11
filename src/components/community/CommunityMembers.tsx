import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, UserPlus } from "lucide-react";

interface CommunityMembersProps {
  community: any;
  userRole: 'owner' | 'member' | 'public';
}

export const CommunityMembers = ({ community, userRole }: CommunityMembersProps) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">0 members</p>
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
            <Input placeholder="Search members..." className="pl-9" />
          </div>

          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No members yet — invite a few artists to join!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
