import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, CheckCircle, Clock, XCircle, AlertCircle, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast } from "date-fns";

interface CommunityOverviewProps {
  community: any;
  userRole: 'owner' | 'member' | 'public';
}

export const CommunityOverview = ({ community, userRole }: CommunityOverviewProps) => {
  const navigate = useNavigate();
  const [memberCount, setMemberCount] = React.useState(0);
  const [eventCount, setEventCount] = React.useState(0);
  const [upcomingEvents, setUpcomingEvents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchStats();
  }, [community.id]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Get member count
      const { count: members } = await supabase
        .from("community_members")
        .select("*", { count: 'exact', head: true })
        .eq("community_id", community.id);

      setMemberCount(members || 0);

      // Get all events
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .eq("community_id", community.id)
        .order("event_date", { ascending: true });

      const allEvents = events || [];
      setEventCount(allEvents.length);

      // Filter upcoming events
      const upcoming = allEvents.filter(event => !isPast(new Date(event.event_date)));
      setUpcomingEvents(upcoming.slice(0, 3)); // Show max 3
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center justify-between">
            <CardTitle>Upcoming Events</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(`/community/${community.id}?tab=events`)}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading events...</p>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming events. Click Create Event to host your first!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map(event => (
                <div 
                  key={event.id} 
                  className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/community/${community.id}?tab=events`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{event.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(event.event_date), "MMM dd, yyyy • h:mm a")}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant={event.ticket_type === 'paid' ? 'default' : 'secondary'}>
                      {event.ticket_type === 'paid' ? 'Paid' : 'Free'}
                    </Badge>
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
