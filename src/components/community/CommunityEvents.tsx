import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, MapPin, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast } from "date-fns";

interface CommunityEventsProps {
  community: any;
  userRole: 'owner' | 'member' | 'public';
}

export const CommunityEvents = ({ community, userRole }: CommunityEventsProps) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreatePaidEvents = community.kyc_status === 'ACTIVATED';

  useEffect(() => {
    fetchEvents();
  }, [community.id]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("community_id", community.id)
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
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>
                {event.performer_slots} performer slot{event.performer_slots > 1 ? 's' : ''}
                {event.audience_enabled && `, ${event.audience_slots} audience slot${event.audience_slots > 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t">
              {event.description}
            </p>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t mt-4">
          <Link to={`/events/${event.id}`} className="flex-1">
            <Button variant="outline" className="w-full">View</Button>
          </Link>
          {userRole === 'owner' && (
            <Link to={`/events/${event.id}/dashboard`} className="flex-1">
              <Button className="w-full">Manage</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Events</CardTitle>
            {userRole === 'owner' && (
              <Button onClick={() => navigate(`/community/${community.id}/create-event`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-muted-foreground">Loading events...</p>
            </div>
          ) : (
            <Tabs defaultValue="upcoming" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upcoming">
                  Upcoming ({upcomingEvents.length})
                </TabsTrigger>
                <TabsTrigger value="past">
                  Past ({pastEvents.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming">
                {upcomingEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No upcoming events. {userRole === 'owner' && 'Click Create Event to host your first!'}</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {upcomingEvents.map(renderEventCard)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="past">
                {pastEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Your event history will appear here</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {pastEvents.map(renderEventCard)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
