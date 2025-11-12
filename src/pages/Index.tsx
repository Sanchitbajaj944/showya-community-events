import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Users, Mic, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import CommunityCard from "@/components/CommunityCard";
import FeatureCard from "@/components/FeatureCard";
import { BottomNav } from "@/components/BottomNav";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast } from "date-fns";
import heroImage from "@/assets/hero-image.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

const Index = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    fetchUpcomingEvents();
    fetchCommunities();
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const cardWidth = container.scrollWidth / events.length;
      const index = Math.round(container.scrollLeft / cardWidth);
      setActiveEventIndex(index);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [events.length]);

  const fetchUpcomingEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: true })
        .limit(8);

      if (error) throw error;
      
      // Filter only upcoming events
      const upcoming = (data || []).filter(event => !isPast(new Date(event.event_date)));
      setEvents(upcoming.slice(0, 4)); // Show max 4 on homepage
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };

  const fetchCommunities = async () => {
    try {
      const { data: communitiesData, error: communitiesError } = await supabase
        .from("communities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      if (communitiesError) throw communitiesError;

      if (!communitiesData || communitiesData.length === 0) {
        setCommunities([]);
        return;
      }

      // Fetch owner details for each community
      const ownerIds = [...new Set(communitiesData.map(c => c.owner_id).filter(Boolean))];
      
      if (ownerIds.length === 0) {
        setCommunities(communitiesData.map(c => ({ ...c, owner: null })));
        return;
      }

      const { data: ownersData, error: ownersError } = await supabase
        .from("profiles_public")
        .select("user_id, name, display_name, profile_picture_url")
        .in("user_id", ownerIds);

      if (ownersError) {
        console.error("Error fetching owners:", ownersError);
        setCommunities(communitiesData.map(c => ({ ...c, owner: null })));
        return;
      }

      // Combine communities with owner data
      const communitiesWithOwners = communitiesData.map(community => ({
        ...community,
        owner: ownersData?.find(owner => owner.user_id === community.owner_id) || null
      }));

      console.log("Communities with owners:", communitiesWithOwners);
      setCommunities(communitiesWithOwners);
    } catch (error) {
      console.error("Error fetching communities:", error);
    }
  };

  const features = [
    {
      icon: Users,
      title: t('home.buildCommunities'),
      description: t('home.buildCommunitiesDescription'),
    },
    {
      icon: Mic,
      title: t('home.hostOrPerform'),
      description: t('home.hostOrPerformDescription'),
    },
    {
      icon: Heart,
      title: t('home.discoverYourTribe'),
      description: t('home.discoverYourTribeDescription'),
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
              <span className="text-sm font-semibold text-primary">🇮🇳 India's Largest Online Open Mic Platform</span>
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
              {user ? (
                <>
                  <Button 
                    size="lg" 
                    variant="default" 
                    className="text-base w-full sm:w-auto"
                    onClick={() => scrollToSection('events')}
                  >
                    View Events
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="text-base w-full sm:w-auto"
                    onClick={() => scrollToSection('communities')}
                  >
                    View Communities
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="text-base w-full sm:w-auto"
                    onClick={() => scrollToSection('why-showya')}
                  >
                    Why Showya
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/auth/signup">
                    <Button size="lg" variant="default" className="text-base w-full sm:w-auto">
                      Create Your Community
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="text-base w-full sm:w-auto"
                    onClick={() => scrollToSection('events')}
                  >
                    View Events
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="text-base w-full sm:w-auto"
                    onClick={() => scrollToSection('why-showya')}
                  >
                    Why Showya
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section id="events" className="py-12 sm:py-16 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mb-10 sm:mb-12 md:mb-16 space-y-3 sm:space-y-4 md:space-y-5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
              What's happening <span className="text-gradient">near you</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
              Browse open mics, art jams, and creative meetups hosted by passionate communities.
            </p>
          </div>
          {events.length === 0 ? (
            <div className="w-full text-center py-8 text-muted-foreground">
              <p>No upcoming events yet. Create a community to host the first one!</p>
            </div>
          ) : (
            <div className="relative">
              <div 
                ref={scrollContainerRef}
                className="flex overflow-x-scroll gap-6 pb-6 snap-x snap-mandatory px-4 -mx-4"
                style={{ 
                  scrollPaddingLeft: '1rem',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {events.map((event) => (
                  <Link 
                    key={event.id} 
                    to={`/events/${event.id}`}
                    className="snap-start shrink-0 first:ml-0"
                    style={{ width: 'min(320px, 85vw)' }}
                  >
                    <EventCard 
                      title={event.title}
                      community={event.community_name}
                      date={format(new Date(event.event_date), "MMM dd, yyyy • h:mm a")}
                      location={event.location || event.city || "Online"}
                      attendees={event.performer_slots + (event.audience_enabled ? event.audience_slots : 0)}
                      category={event.category || "Event"}
                      image={event.poster_url}
                    />
                  </Link>
                ))}
              </div>
              {events.length > 1 && (
                <div className="flex justify-center gap-2 mt-2">
                  {events.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 w-2 rounded-full transition-all duration-300 ${
                        index === activeEventIndex ? 'bg-primary w-6' : 'bg-primary/30'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mt-8 sm:mt-10 md:mt-12 text-center">
            <Link to="/events">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                Explore All Events
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Communities Section */}
      <section id="communities" className="py-12 sm:py-16 md:py-24 lg:py-32 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mb-10 sm:mb-12 md:mb-16 space-y-3 sm:space-y-4 md:space-y-5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Communities <span className="text-gradient">you'll love</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
              Connect with passionate groups hosting amazing creative experiences across India.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {communities.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                <p>No communities yet. Be the first to create one!</p>
              </div>
            ) : (
              communities.map((community) => (
                <Link key={community.id} to={`/community/${community.id}/public`}>
                  <Card className="group overflow-hidden hover:shadow-glow transition-all duration-300 cursor-pointer border-2 hover:border-primary/30 h-full flex flex-col">
                    {/* Banner Image */}
                    <div className="relative h-48 flex-shrink-0 overflow-hidden bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20">
                      {community.banner_url ? (
                        <img 
                          src={community.banner_url} 
                          alt={community.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="h-16 w-16 text-primary/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>

                    {/* Community Info */}
                    <CardContent className="p-5 space-y-3 flex-1 flex flex-col">
                      <div>
                        <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-gradient transition-all">
                          {community.name}
                        </h3>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {community.categories?.slice(0, 3).map((cat: string) => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                          {community.categories && community.categories.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{community.categories.length - 3}
                            </Badge>
                          )}
                        </div>
                        {community.owner && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {community.owner.profile_picture_url ? (
                                <img 
                                  src={community.owner.profile_picture_url} 
                                  alt={community.owner.display_name || community.owner.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Users className="h-3 w-3 text-primary" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">
                              by {community.owner.display_name || community.owner.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {community.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {community.description}
                        </p>
                      )}

                      <Button className="w-full mt-auto">
                        View Community
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
          <div className="mt-10 sm:mt-12 md:mt-16 text-center">
            <Link to="/communities">
              <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                Discover More Communities
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Showya Section */}
      <section id="why-showya" className="py-12 sm:py-16 md:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary rounded-full blur-3xl" />
        </div>
        <div className="container relative px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12 md:mb-16 space-y-3 sm:space-y-4 md:space-y-5">
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
              {user ? (
                <>
                  <Button 
                    size="lg" 
                    variant="default" 
                    className="text-base w-full sm:w-auto"
                    onClick={() => scrollToSection('communities')}
                  >
                    View Communities
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="text-base w-full sm:w-auto"
                    onClick={() => scrollToSection('events')}
                  >
                    View Events
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/auth/signup">
                    <Button size="lg" variant="default" className="text-base w-full sm:w-auto">
                      Create Your Community
                    </Button>
                  </Link>
                  <Link to="/events">
                    <Button size="lg" variant="outline" className="text-base w-full sm:w-auto">
                      Explore Events
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <BottomNav />

    </div>
  );
};

export default Index;
