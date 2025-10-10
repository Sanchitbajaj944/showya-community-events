import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Communities() {
  const communities = [
    {
      name: "Mumbai Poetry Club",
      description: "A vibrant community of poets, writers, and spoken word artists sharing their craft.",
      members: 1234,
      upcomingEvents: 5,
      location: "Mumbai",
    },
    {
      name: "Bangalore Music Collective",
      description: "Musicians and music lovers coming together to jam, perform, and celebrate music.",
      members: 2156,
      upcomingEvents: 8,
      location: "Bangalore",
    },
    {
      name: "Delhi Comedy Circuit",
      description: "Stand-up comedians and comedy enthusiasts creating laughter and memorable moments.",
      members: 987,
      upcomingEvents: 4,
      location: "Delhi",
    },
    {
      name: "Chennai Theatre Group",
      description: "Actors, directors, and theatre lovers producing amazing performances together.",
      members: 756,
      upcomingEvents: 3,
      location: "Chennai",
    },
    {
      name: "Pune Artists Guild",
      description: "Painters, sketchers, and visual artists exploring creativity through various mediums.",
      members: 643,
      upcomingEvents: 6,
      location: "Pune",
    },
    {
      name: "Kolkata Writers Circle",
      description: "Authors, bloggers, and storytellers sharing their narratives and improving their craft.",
      members: 892,
      upcomingEvents: 4,
      location: "Kolkata",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">Creative Communities</h1>
          <p className="text-muted-foreground text-lg">
            Connect with passionate groups hosting amazing experiences across India
          </p>
        </div>

        {/* Communities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {communities.map((community, index) => (
            <div
              key={index}
              className="group rounded-xl border border-border bg-card p-6 hover:shadow-lg transition-all duration-300"
            >
              {/* Community Avatar */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>

              {/* Community Info */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                    {community.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3" />
                    <span>{community.location}</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">
                  {community.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {community.members.toLocaleString()} members
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {community.upcomingEvents} events
                  </Badge>
                </div>

                <Button className="w-full mt-4" variant="outline">
                  View Community
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center p-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border">
          <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h3 className="text-2xl font-bold mb-2">Start Your Own Community</h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Have a passion you want to share? Create your own community and bring people together around what you love.
          </p>
          <Button size="lg">Create Community</Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}