import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CommunityOverviewProps {
  community: any;
  userRole: 'owner' | 'member' | 'public';
}

export const CommunityOverview = ({ community, userRole }: CommunityOverviewProps) => {
  const navigate = useNavigate();
  const [memberCount, setMemberCount] = React.useState(0);
  const [eventCount, setEventCount] = React.useState(0);

  React.useEffect(() => {
    fetchStats();
  }, [community.id]);

  const fetchStats = async () => {
    // Get member count
    const { count: members } = await supabase
      .from("community_members")
      .select("*", { count: 'exact', head: true })
      .eq("community_id", community.id);

    setMemberCount(members || 0);

    // Get event count (TODO: when events table is ready)
    setEventCount(0);
  };

  const getKycBadge = (status: string) => {
    switch (status) {
      case 'ACTIVATED':
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            <CheckCircle className="h-4 w-4 mr-1" />
            KYC Activated
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
            <Clock className="h-4 w-4 mr-1" />
            KYC In Progress
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            <XCircle className="h-4 w-4 mr-1" />
            KYC Needs Action
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-orange-500 text-orange-500">
            <AlertCircle className="h-4 w-4 mr-1" />
            KYC Required
          </Badge>
        );
    }
  };

  const canCreatePaidEvents = community.kyc_status === 'ACTIVATED';

  return (
    <div className="space-y-6">
      {/* Banner & Header */}
      <Card>
        <CardContent className="pt-6">
          {/* Banner placeholder */}
          <div className="w-full h-48 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 mb-6" />
          
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{community.name}</h1>
                {community.categories && community.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {community.categories.map((cat: string) => (
                      <Badge key={cat} variant="secondary">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}
                {community.description && (
                  <p className="text-muted-foreground">{community.description}</p>
                )}
              </div>
              {getKycBadge(community.kyc_status)}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center p-4 rounded-lg bg-muted">
                <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{memberCount}</p>
                <p className="text-sm text-muted-foreground">Members</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <Calendar className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{eventCount}</p>
                <p className="text-sm text-muted-foreground">Events Hosted</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate(`/community/${community.id}/create-event`)}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Create Event
          </Button>
          {!canCreatePaidEvents && (
            <p className="text-xs text-muted-foreground text-center">
              💡 Free events are always available. Complete KYC to enable paid events.
            </p>
          )}
          <Button variant="outline" className="w-full" size="lg">
            <Users className="h-4 w-4 mr-2" />
            Invite Members
          </Button>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No events yet. Click Create Event to host your first!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
