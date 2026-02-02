import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import EventCard from "@/components/EventCard";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useRef, useEffect, useState } from "react";

interface EventsSectionProps {
  events: any[];
}

export function EventsSection({ events }: EventsSectionProps) {
  const { t } = useTranslation();
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  return (
    <section id="events" className="py-12 sm:py-16 md:py-24 lg:py-32">
      <div className="container px-4 md:px-6">
        <div className="max-w-3xl mb-10 sm:mb-12 md:mb-16 space-y-3 sm:space-y-4 md:space-y-5">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
            {t('home.whatsHappening')} <span className="text-gradient">{t('home.whatsHappeningGradient')}</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
            {t('home.whatsHappeningDescription')}
          </p>
        </div>
        {events.length === 0 ? (
          <div className="w-full text-center py-8 text-muted-foreground">
            <p>{t('home.noUpcomingEvents')}</p>
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
              {t('home.exploreAllEvents')}
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
