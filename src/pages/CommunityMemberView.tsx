import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, MessageCircle, Share2, LogOut, Info, CheckCircle, MapPin, Clock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";
import { format, isPast } from "date-fns";
import { CommunityChat } from "@/components/community/CommunityChat";

export default function CommunityMemberView() {
  const { communityId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [joinDate, setJoinDate] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth/signin");
      return;
    }
    fetchCommunityData();
  }, [communityId, user]);

  const fetchCommunityData = async () => {
    if (!communityId || !user) return;

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

      // Fetch owner profile (use public view for other users)
      const { data: ownerData } = await supabase
        .from("profiles_public")
        .select("display_name, name, profile_picture_url")
        .eq("user_id", communityData.owner_id)
        .single();

      setOwnerProfile(ownerData);

      // Fetch members (use public view for member profiles)
      const { data: membersData } = await supabase
        .from("community_members")
        .select(`
          *,
          profile:profiles_public!community_members_user_id_fkey(
            display_name,
            name,
            profile_picture_url
          )
        `)
        .eq("community_id", communityId);

      setMembers(membersData || []);

      // Get user's join date
      const userMember = membersData?.find(m => m.user_id === user.id);
      if (userMember) {
        setJoinDate(new Date(userMember.joined_at).toLocaleDateString());
      }
    } catch (error: any) {
      console.error("Error fetching community:", error);
      toast.error("Failed to load community");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !communityId) return;

    try {
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Left community");
      navigate("/communities");
    } catch (error: any) {
      console.error("Error leaving community:", error);
      toast.error("Failed to leave community");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: community.name,
          text: community.description,
          url: url,
        });
      } catch (error) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
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

  const ownerName = ownerProfile?.display_name || ownerProfile?.name || "Community Owner";

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl space-y-4 sm:space-y-6">
        {/* Community Header */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="w-full h-32 sm:h-48 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 mb-4 sm:mb-6" />
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">{community.name}</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                    Hosted by @{ownerName}
                  </p>
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
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                      <LogOut className="h-4 w-4 mr-2" />
                      <span className="text-sm sm:text-base">Leave Community</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave Community?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to leave this community? You'll need to rejoin to access events and chat.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLeave}>
                        Leave
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" onClick={handleShare} className="w-full sm:w-auto">
                  <Share2 className="h-4 w-4 mr-2" />
                  <span className="text-sm sm:text-base">Share</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="about" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
              <TabsTrigger value="about" className="flex-1 sm:flex-none text-xs sm:text-sm">About</TabsTrigger>
              <TabsTrigger value="events" className="flex-1 sm:flex-none text-xs sm:text-sm">Events</TabsTrigger>
              <TabsTrigger value="members" className="flex-1 sm:flex-none text-xs sm:text-sm">Members</TabsTrigger>
              <TabsTrigger value="chat" className="flex-1 sm:flex-none text-xs sm:text-sm">Chat</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="about">
            <Card>
              <CardContent className="pt-4 sm:pt-6 space-y-3 sm:space-y-4">
                <div>
                  <h3 className="font-semibold text-sm sm:text-base mb-2">Description</h3>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    {community.description || "No description provided"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Members</p>
                    <p className="text-xl sm:text-2xl font-bold">{members.length}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">You Joined</p>
                    <p className="text-xl sm:text-2xl font-bold break-words">{joinDate}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <MemberEventsView communityId={communityId!} />
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl">{members.length} Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 sm:space-y-3">
                  {members.map((member) => (
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
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <CommunityChat community={community} userRole="member" />
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}

const MemberEventsView = ({ communityId }: { communityId: string }) => {
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
        .order("event_date", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const upcomingEvents = events.filter(event => !isPast(new Date(event.event_date)));
  const pastEvents = events.filter(event => isPast(new Date(event.event_date)));

  const renderEventCard = (event: any) => (
    <Card key={event.id} className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        {event.poster_url && (
          <div className="w-full h-48 rounded-lg overflow-hidden mb-4">
            <img 
              src={event.poster_url} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="space-y-3">
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-lg line-clamp-2">{event.title}</h3>
              <Badge variant={event.ticket_type === 'paid' ? 'default' : 'secondary'}>
                {event.ticket_type === 'paid' ? 'Paid' : 'Free'}
              </Badge>
            </div>
            {event.category && (
              <Badge variant="outline" className="mb-2">{event.category}</Badge>
            )}
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(event.event_date), "MMM dd, yyyy • h:mm a")}</span>
            </div>
            {event.duration && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{event.duration} minutes</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
            )}
          </div>
          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t">
              {event.description}
            </p>
          )}
          <Button className="w-full mt-2">
            {event.ticket_type === 'paid' ? `Book Ticket • ₹${event.performer_ticket_price}` : 'View Details'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted-foreground">Loading events...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming ({upcomingEvents.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastEvents.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm sm:text-base">No upcoming events. Stay tuned!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingEvents.map(renderEventCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastEvents.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm sm:text-base">No past events</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pastEvents.map(renderEventCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
