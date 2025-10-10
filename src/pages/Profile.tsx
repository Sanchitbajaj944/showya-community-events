import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { BottomNav } from "@/components/BottomNav";
import Header from "@/components/Header";
import { MapPin, Edit, Calendar, Star, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  display_name?: string;
  bio?: string;
  city?: string;
  profile_picture_url?: string;
  skills?: string[];
}

interface EventParticipation {
  id: string;
  event: {
    id: string;
    title: string;
    event_date: string;
    location: string;
    community_name: string;
    category: string;
  };
  role: "performer" | "audience";
  ticket_code?: string;
}

interface Spotlight {
  id: string;
  community_name: string;
  feature_text: string;
  event_id?: string;
}

export default function Profile() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<EventParticipation[]>([]);
  const [pastEvents, setPastEvents] = useState<EventParticipation[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [performanceCount, setPerformanceCount] = useState(0);

  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!user && !userId) {
      navigate("/auth/signin");
      return;
    }
    fetchProfileData();
  }, [targetUserId, user]);

  const fetchProfileData = async () => {
    if (!targetUserId) return;

    try {
      setLoading(true);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", targetUserId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch event participations
      const { data: participations, error: participationsError } = await supabase
        .from("event_participants")
        .select(`
          id,
          role,
          ticket_code,
          event:events(
            id,
            title,
            event_date,
            location,
            community_name,
            category
          )
        `)
        .eq("user_id", targetUserId);

      if (participationsError) throw participationsError;

      const now = new Date();
      const upcoming = participations?.filter((p: any) => new Date(p.event.event_date) >= now) || [];
      const past = participations?.filter((p: any) => new Date(p.event.event_date) < now) || [];

      // Sort upcoming by date (earliest first), past by date (most recent first)
      upcoming.sort((a: any, b: any) => new Date(a.event.event_date).getTime() - new Date(b.event.event_date).getTime());
      past.sort((a: any, b: any) => new Date(b.event.event_date).getTime() - new Date(a.event.event_date).getTime());

      setUpcomingEvents(upcoming as EventParticipation[]);
      setPastEvents(past as EventParticipation[]);

      // Count performances (past performer events)
      const performanceCount = past.filter((p: any) => p.role === "performer").length;
      setPerformanceCount(performanceCount);

      // Fetch spotlights
      const { data: spotlightsData, error: spotlightsError } = await supabase
        .from("spotlights")
        .select("*")
        .eq("user_id", targetUserId);

      if (spotlightsError) throw spotlightsError;
      setSpotlights(spotlightsData || []);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-lg">Profile not found</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const displayName = profile.display_name || profile.name || "User";

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />
      
      {/* Mobile-only sub-header */}
      <div className="md:hidden bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {userId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-lg font-semibold flex-1 text-center">
              {isOwnProfile ? "My Profile" : displayName}
            </h1>
            {isOwnProfile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/profile/edit")}
              >
                <Edit className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <UserAvatar
                src={profile.profile_picture_url}
                name={displayName}
                size="xl"
              />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">{displayName}</h2>
                {profile.city && (
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{profile.city}</span>
                  </div>
                )}
                {profile.bio && (
                  <p className="text-sm text-muted-foreground max-w-md">
                    {profile.bio}
                  </p>
                )}
              </div>

              {/* Skills */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {profile.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Performance Counter */}
              {performanceCount > 0 && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    🎭 Performed in <span className="font-semibold text-primary">{performanceCount}</span> {performanceCount === 1 ? 'event' : 'events'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Spotlights */}
        {spotlights.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Star className="h-5 w-5 text-primary fill-primary" />
                Spotlights & Features
              </h3>
              <div className="space-y-3">
                {spotlights.map((spotlight) => (
                  <div
                    key={spotlight.id}
                    className="p-4 rounded-lg bg-muted/50 border border-border"
                  >
                    <p className="font-medium text-sm text-primary mb-1">
                      Featured by {spotlight.community_name}
                    </p>
                    <p className="text-sm">{spotlight.feature_text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Experience Tabs */}
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="upcoming" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upcoming">
                  Upcoming ({upcomingEvents.length})
                </TabsTrigger>
                <TabsTrigger value="past">
                  Past ({pastEvents.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="mt-4 space-y-3">
                {upcomingEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No upcoming events yet!</p>
                  </div>
                ) : (
                  upcomingEvents.map((participation) => (
                    <EventCard
                      key={participation.id}
                      event={participation.event}
                      role={participation.role === "performer" ? "Performer" : "Audience"}
                      ticketCode={participation.ticket_code}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="past" className="mt-4 space-y-3">
                {pastEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Your event history will appear here!</p>
                  </div>
                ) : (
                  pastEvents.map((participation) => (
                    <EventCard
                      key={participation.id}
                      event={participation.event}
                      role={participation.role === "performer" ? "Performer" : "Audience"}
                      ticketCode={participation.ticket_code}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}

interface EventCardProps {
  event: {
    id: string;
    title: string;
    event_date: string;
    location: string;
    community_name: string;
    category: string;
  };
  role: string;
  ticketCode?: string;
}

function EventCard({ event, role, ticketCode }: EventCardProps) {
  return (
    <div className="p-4 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate">{event.title}</h4>
            <p className="text-sm text-muted-foreground">{event.community_name}</p>
          </div>
          <Badge variant={role === "Performer" ? "default" : "secondary"}>
            {role}
          </Badge>
        </div>

        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(event.event_date), "MMM d, yyyy • h:mm a")}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{event.location}</span>
          </div>
        </div>

        {ticketCode && (
          <div className="mt-2 p-2 bg-muted rounded text-xs font-mono text-center">
            Ticket: {ticketCode}
          </div>
        )}
      </div>
    </div>
  );
}