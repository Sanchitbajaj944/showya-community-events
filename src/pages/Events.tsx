import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast } from "date-fns";

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
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
    <div
      key={event.id}
      className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center overflow-hidden">
        {event.poster_url ? (
          <img 
            src={event.poster_url} 
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Calendar className="h-12 w-12 text-primary" />
        )}
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1 truncate group-hover:text-primary transition-colors">
              {event.title}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {event.community_name}
            </p>
          </div>
          <Badge variant="secondary">{event.category || 'Event'}</Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{format(new Date(event.event_date), "MMM dd, yyyy • h:mm a")}</span>
          </div>
          {event.duration && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{event.duration} minutes</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0" />
            <span>
              {event.performer_slots} performer{event.performer_slots > 1 ? 's' : ''}
              {event.audience_enabled && `, ${event.audience_slots} audience`}
            </span>
          </div>
        </div>

        <Button className="w-full mt-4" variant={event.ticket_type === 'paid' ? 'default' : 'outline'}>
          {event.ticket_type === 'paid' ? `Book Now • ₹${event.performer_ticket_price}` : 'View Details'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">Creative Events</h1>
          <p className="text-muted-foreground text-lg">
            Discover amazing creative experiences happening across communities
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted-foreground">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center p-12 rounded-xl border-2 border-dashed border-border">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No events yet</h3>
            <p className="text-muted-foreground mb-4">
              Be the first to create an event in your community!
            </p>
            <Link to="/communities">
              <Button variant="outline">Explore Communities</Button>
            </Link>
          </div>
        ) : (
          <Tabs defaultValue="upcoming" className="space-y-6">
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming ({upcomingEvents.length})</TabsTrigger>
              <TabsTrigger value="past">Past ({pastEvents.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              {upcomingEvents.length === 0 ? (
                <div className="text-center p-12 rounded-xl border-2 border-dashed border-border">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
                  <p className="text-muted-foreground">Check back soon for new events!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingEvents.map(renderEventCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past">
              {pastEvents.length === 0 ? (
                <div className="text-center p-12 rounded-xl border-2 border-dashed border-border">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No past events</h3>
                  <p className="text-muted-foreground">Past events will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastEvents.map(renderEventCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <BottomNav />
    </div>
  );
}