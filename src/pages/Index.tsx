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
      <section className="relative overflow-hidden py-16 sm:py-20 md:py-28 bg-background">
        <div className="container px-4 md:px-6">
          <div className="max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
            <div className="inline-block px-5 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-sm font-semibold text-primary">✨ Where Communities Come Alive</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight">
              Discover Events.
              <br />
              <span className="text-gradient">Build Communities.</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Join Showya to discover amazing events, connect with vibrant communities, and showcase your talent as a performer or host.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" variant="default" className="text-base w-full sm:w-auto">
                Explore Events
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-base w-full sm:w-auto">
                Join as Performer
              </Button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-12 sm:pt-16">
              <div className="space-y-2">
                <div className="text-4xl sm:text-5xl font-extrabold text-primary">100+</div>
                <div className="text-sm sm:text-base text-muted-foreground">Communities</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl sm:text-5xl font-extrabold text-accent">500+</div>
                <div className="text-sm sm:text-base text-muted-foreground">Events Hosted</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl sm:text-5xl font-extrabold text-secondary">5K+</div>
                <div className="text-sm sm:text-base text-muted-foreground">Members</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section id="events" className="py-12 sm:py-16 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mb-10 sm:mb-12 md:mb-16 space-y-3 sm:space-y-4 md:space-y-5">
            <div className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-gradient-card border-2 border-primary/20">
              <span className="text-xs sm:text-sm font-bold text-primary">Featured Events</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
              What's happening <span className="text-gradient">near you</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
              Browse open mics, art jams, and creative meetups hosted by passionate communities.
            </p>
          </div>
          <div className="flex overflow-x-auto gap-4 sm:gap-6 pb-6 snap-x snap-mandatory hide-scrollbar -mx-4 px-4">
            {upcomingEvents.map((event, index) => (
              <div key={index} className="snap-start">
                <EventCard {...event} />
              </div>
            ))}
          </div>
          <div className="mt-8 sm:mt-10 md:mt-12 text-center">
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              Explore All Events
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Communities Section */}
      <section id="communities" className="py-12 sm:py-16 md:py-24 lg:py-32 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mb-10 sm:mb-12 md:mb-16 space-y-3 sm:space-y-4 md:space-y-5">
            <div className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-gradient-card border-2 border-secondary/20">
              <span className="text-xs sm:text-sm font-bold text-secondary">Top Communities</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Communities <span className="text-gradient">you'll love</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
              Connect with passionate groups hosting amazing creative experiences across India.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {communities.map((community, index) => (
              <CommunityCard key={index} {...community} />
            ))}
          </div>
          <div className="mt-10 sm:mt-12 md:mt-16 text-center">
            <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
              Discover More Communities
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Why Showya Section */}
      <section className="py-12 sm:py-16 md:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary rounded-full blur-3xl" />
        </div>
        <div className="container relative px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12 md:mb-16 space-y-3 sm:space-y-4 md:space-y-5">
            <div className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-gradient-card border-2 border-accent/20">
              <span className="text-xs sm:text-sm font-bold text-accent">Why Showya</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Made for <span className="text-gradient">creators</span>, by creators
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-20 md:py-24 relative overflow-hidden bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
              Ready to join India's <span className="text-gradient">creative movement?</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Start hosting events or discover your tribe today. No downloads needed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" variant="default" className="text-base w-full sm:w-auto">
                Create Your Community
              </Button>
              <Button size="lg" variant="outline" className="text-base w-full sm:w-auto">
                Explore Events
              </Button>
            </div>
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
