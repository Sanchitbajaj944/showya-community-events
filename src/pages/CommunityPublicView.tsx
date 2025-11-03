import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, UserPlus, CheckCircle, MoreVertical, Flag } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/ReportDialog";
import { ShareDialog } from "@/components/ShareDialog";
import { toast } from "sonner";
import { format, isPast } from "date-fns";

export default function CommunityPublicView() {
  const { communityId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<any>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  useEffect(() => {
    fetchCommunityData();
  }, [communityId]);

  const fetchCommunityData = async () => {
    if (!communityId) return;

    try {
      setLoading(true);

      // Fetch community
      const { data: communityData, error: communityError } = await supabase
        .from("communities")
        .select("*")
        .eq("id", communityId)
        .single();

      if (communityError) throw communityError;
      setCommunity(communityData);

      // Get member count using public function
      const { data: countData, error: countError } = await supabase
        .rpc('get_community_member_count', { p_community_id: communityId });

      setMemberCount(countData || 0);
    } catch (error: any) {
      console.error("Error fetching community:", error);
      toast.error("Failed to load community");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      navigate("/auth/signin");
      return;
    }

    setJoining(true);
    try {
      const { error } = await supabase
        .from("community_members")
        .insert({
          community_id: communityId,
          user_id: user.id,
          role: 'member'
        });

      if (error) throw error;

      toast.success("Joined community successfully!");
      navigate(`/community/${communityId}`);
    } catch (error: any) {
      console.error("Error joining community:", error);
      toast.error("Failed to join community");
    } finally {
      setJoining(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading community...</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg">Community not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl space-y-4 sm:space-y-6">
        {/* Community Header */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            {/* Banner placeholder */}
            <div className="w-full h-32 sm:h-48 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 mb-4 sm:mb-6" />
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">{community.name}</h1>
                  {community.categories && community.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {community.categories.map((cat: string) => (
                        <Badge key={cat} variant="secondary">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {community.kyc_status === 'APPROVED' && (
                    <Badge variant="outline" className="border-green-500 text-green-500 mb-3">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified Host
                    </Badge>
                  )}
                  {community.description && (
                    <p className="text-muted-foreground">{community.description}</p>
                  )}
                </div>
              </div>

              {/* Member Count */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">
                  {memberCount > 0 ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : 'Be the first to join!'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t">
                <Button 
                  className="flex-1 w-full" 
                  size="lg" 
                  onClick={handleJoin}
                  disabled={joining}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  <span className="text-sm sm:text-base">{joining ? "Joining..." : "Join Community"}</span>
                </Button>
                <ShareDialog
                  url={`/community/${communityId}/public`}
                  title={community.name}
                  description={community.description}
                  triggerClassName="w-full sm:w-auto h-10"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setReportDialogOpen(true)}>
                      <Flag className="h-4 w-4 mr-2" />
                      Report Community Owner
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events Preview */}
        <EventsPreview communityId={communityId!} />
      </div>

      {community && (
        <ReportDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          targetUserId={community.owner_id}
          targetType="community_owner"
          contextType="community"
          contextId={communityId}
          targetName={community.name}
        />
      )}

      <BottomNav />
    </div>
  );
}

const EventsPreview = ({ communityId }: { communityId: string }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [communityId]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("community_id", communityId)
        .order("event_date", { ascending: true })
        .limit(3);

      if (error) throw error;
      
      const upcoming = (data || []).filter(event => !isPast(new Date(event.event_date)));
      setEvents(upcoming);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Upcoming Events</h3>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-muted-foreground">
            <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-sm sm:text-base">No upcoming events. Join to see when new events are posted!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(event => (
              <div key={event.id} className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{event.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(event.event_date), "MMM dd, yyyy • h:mm a")}
                    </p>
                    {event.location && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{event.location}</p>
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
  );
};
