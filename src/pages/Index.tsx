import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Mic, Heart } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import CommunityCard from "@/components/CommunityCard";
import FeatureCard from "@/components/FeatureCard";
import heroImage from "@/assets/hero-image.jpg";

const Index = () => {
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

  const communities = [
    {
      name: "Mumbai Poetry Club",
      description: "A vibrant community of poets, writers, and spoken word artists sharing their craft.",
      members: 1234,
      upcomingEvents: 5,
    },
    {
      name: "Bangalore Music Collective",
      description: "Musicians and music lovers coming together to jam, perform, and celebrate music.",
      members: 2156,
      upcomingEvents: 8,
    },
    {
      name: "Delhi Comedy Circuit",
      description: "Stand-up comedians and comedy enthusiasts creating laughter and memorable moments.",
      members: 987,
      upcomingEvents: 4,
    },
    {
      name: "Chennai Theatre Group",
      description: "Actors, directors, and theatre lovers producing amazing performances together.",
      members: 756,
      upcomingEvents: 3,
    },
    {
      name: "Pune Artists Guild",
      description: "Painters, sketchers, and visual artists exploring creativity through various mediums.",
      members: 643,
      upcomingEvents: 6,
    },
    {
      name: "Kolkata Writers Circle",
      description: "Authors, bloggers, and storytellers sharing their narratives and improving their craft.",
      members: 892,
      upcomingEvents: 4,
    },
  ];

  const features = [
    {
      icon: Users,
      title: "Build Communities",
      description: "Start and manage creative communities effortlessly.",
    },
    {
      icon: Mic,
      title: "Host or Perform",
      description: "Whether you organize or perform, find your space.",
    },
    {
      icon: Heart,
      title: "Discover Your Tribe",
      description: "Join creative groups that match your passion.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-90" />
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Creative community"
            className="w-full h-full object-cover mix-blend-overlay"
          />
        </div>
        <div className="container relative px-4 py-20 md:py-32 md:px-6">
          <div className="max-w-3xl mx-auto text-center text-white space-y-8">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight animate-fade-in">
              Discover Indian creative communities & open mics around you
            </h1>
            <p className="text-lg md:text-xl text-white/90 leading-relaxed animate-fade-in">
              Join India's growing network of artists, poets, musicians and hosts.
              Find events, join communities, or start your own.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Button size="lg" variant="secondary" className="text-base font-semibold">
                Explore Events
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-base font-semibold bg-white/10 text-white border-white hover:bg-white hover:text-primary backdrop-blur-sm">
                Start a Community
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section id="events" className="py-16 md:py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mb-12 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">What's happening near you</h2>
            <p className="text-lg text-muted-foreground">
              Browse open mics, art jams, and creative meetups hosted by communities.
            </p>
          </div>
          <div className="flex overflow-x-auto gap-6 pb-4 snap-x snap-mandatory hide-scrollbar">
            {upcomingEvents.map((event, index) => (
              <div key={index} className="snap-start">
                <EventCard {...event} />
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="link" className="text-primary text-base font-semibold">
              Explore all events
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Communities Section */}
      <section id="communities" className="py-16 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mb-12 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Communities you'll love</h2>
            <p className="text-lg text-muted-foreground">
              Follow communities that host the best creative experiences.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {communities.map((community, index) => (
              <CommunityCard key={index} {...community} />
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button variant="link" className="text-primary text-base font-semibold">
              See more communities
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Why Showya Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-12 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Made for creators, by creators</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <div className="container relative px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center text-white space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold leading-tight">
              Ready to join the next big creative movement?
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="text-base font-semibold">
                Start Your Community
              </Button>
              <Button size="lg" variant="outline" className="text-base font-semibold bg-white/10 text-white border-white hover:bg-white hover:text-primary backdrop-blur-sm">
                Find Events
              </Button>
            </div>
            <p className="text-sm text-white/80">
              No downloads needed — everything runs right in your browser.
            </p>
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default Index;
