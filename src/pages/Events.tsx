import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Events() {
  const upcomingEvents = [
    {
      title: "Poetry Open Mic Night",
      community: "Mumbai Poetry Club",
      date: "Mar 15, 2025 • 7:00 PM",
      location: "Prithvi Theatre, Mumbai",
      attendees: 45,
      category: "Poetry",
    },
    {
      title: "Indie Music Jam Session",
      community: "Bangalore Music Collective",
      date: "Mar 18, 2025 • 6:30 PM",
      location: "The Humming Tree, Bangalore",
      attendees: 67,
      category: "Music",
    },
    {
      title: "Stand-up Comedy Night",
      community: "Delhi Comedy Circuit",
      date: "Mar 20, 2025 • 8:00 PM",
      location: "Canvas Laugh Club, Delhi",
      attendees: 89,
      category: "Comedy",
    },
    {
      title: "Art & Sketching Meetup",
      community: "Pune Artists Guild",
      date: "Mar 22, 2025 • 4:00 PM",
      location: "Cafe Goodluck, Pune",
      attendees: 32,
      category: "Art",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">Upcoming Events</h1>
          <p className="text-muted-foreground text-lg">
            Discover amazing creative experiences happening near you
          </p>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {upcomingEvents.map((event, index) => (
            <div
              key={index}
              className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all duration-300"
            >
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Calendar className="h-12 w-12 text-primary" />
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate group-hover:text-primary transition-colors">
                      {event.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {event.community}
                    </p>
                  </div>
                  <Badge variant="secondary">{event.category}</Badge>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0" />
                    <span>{event.attendees} attending</span>
                  </div>
                </div>

                <Button className="w-full mt-4">View Details</Button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State for More Events */}
        <div className="mt-12 text-center p-12 rounded-xl border-2 border-dashed border-border">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">More events coming soon!</h3>
          <p className="text-muted-foreground mb-4">
            Check back regularly for new creative experiences
          </p>
          <Link to="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}