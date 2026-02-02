import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Mic, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeatureCard from "@/components/FeatureCard";
import { BottomNav } from "@/components/BottomNav";
import { ShowClipsRow } from "@/components/ShowClipsRow";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useHomepageSectionOrder, SectionId } from "@/hooks/useHomepageSectionOrder";
import { EventsSection } from "@/components/home/EventsSection";
import { CommunitiesSection } from "@/components/home/CommunitiesSection";

const Index = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const { user } = useAuth();
  const { sectionOrder } = useHomepageSectionOrder();

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

  const fetchUpcomingEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", new Date().toISOString())  // Only fetch upcoming events
        .eq("is_cancelled", false)  // Exclude cancelled events
        .order("event_date", { ascending: true })
        .limit(4);

      if (error) throw error;
      
      setEvents(data || []);
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

      {/* Hero Section - Only show for non-logged-in users */}
      {!user && (
        <section className="relative overflow-hidden py-16 sm:py-20 md:py-28 bg-background">
          <div className="container px-4 md:px-6">
            <div className="max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
              <div className="inline-block px-5 py-2 rounded-full bg-primary/10 border border-primary/20">
                <span className="text-sm font-semibold text-primary">{t('home.badge')}</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight">
                {t('home.heroTitle')}
                <br />
                <span className="text-gradient">{t('home.heroTitleGradient')}</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                {t('home.heroSubtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link to="/auth/signup">
                  <Button size="lg" variant="default" className="text-base w-full sm:w-auto">
                    {t('home.createYourCommunity')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-base w-full sm:w-auto"
                  onClick={() => scrollToSection('events')}
                >
                  {t('home.viewEvents')}
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-base w-full sm:w-auto"
                  onClick={() => scrollToSection('why-showya')}
                >
                  {t('home.whyShowya')}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Dynamic Sections based on admin-configured order */}
      {sectionOrder.map((sectionId) => {
        switch (sectionId) {
          case 'showclips':
            return <ShowClipsRow key="showclips" />;
          case 'events':
            return <EventsSection key="events" events={events} />;
          case 'communities':
            return <CommunitiesSection key="communities" communities={communities} />;
          default:
            return null;
        }
      })}

      {/* Why Showya Section */}
      <section id="why-showya" className="py-12 sm:py-16 md:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary rounded-full blur-3xl" />
        </div>
        <div className="container relative px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12 md:mb-16 space-y-3 sm:space-y-4 md:space-y-5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
              {t('home.madeForCreators')} <span className="text-gradient">{t('home.madeForCreatorsGradient')}</span>, {t('home.madeForCreatorsSubtitle')}
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
              {t('home.readyToJoin')} <span className="text-gradient">{t('home.readyToJoinGradient')}</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('home.readyToJoinDescription')}
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
                    {t('home.viewCommunities')}
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="text-base w-full sm:w-auto"
                    onClick={() => scrollToSection('events')}
                  >
                    {t('home.viewEvents')}
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/auth/signup">
                    <Button size="lg" variant="default" className="text-base w-full sm:w-auto">
                      {t('home.getStarted')}
                    </Button>
                  </Link>
                  <Link to="/events">
                    <Button size="lg" variant="outline" className="text-base w-full sm:w-auto">
                      {t('home.browseEvents')}
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
