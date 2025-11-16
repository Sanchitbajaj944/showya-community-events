import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ReelCard } from "@/components/ReelCard";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface Reel {
  id: string;
  video_url: string | null;
  caption: string | null;
  view_count: number;
  like_count: number;
  community_name: string;
  feature_text: string;
  created_at: string;
  event_id: string | null;
  user_id: string;
}

export default function Reels() {
  const { t } = useTranslation();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReels();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const viewHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / viewHeight);
      setCurrentIndex(newIndex);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchReels = async () => {
    try {
      console.log("REELS QUERY STARTED (CLIENT)");
      
      const { data, error } = await supabase
        .from("spotlights")
        .select("*")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });

      console.log("REELS QUERY RESULT", { data, error });

      if (error) throw error;
      setReels(data || []);
    } catch (error) {
      console.error("Error fetching reels:", error);
      setReels([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center" style={{ height: "calc(100vh - 4rem)" }}>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!loading && reels.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center" style={{ height: "calc(100vh - 4rem)" }}>
          <div className="text-center px-4">
            <p className="text-xl text-muted-foreground mb-2">{t('reelsPage.noShowClips')}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {t('reelsPage.beFirst')}
            </p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Reels Container with Snap Scroll */}
      <div
        ref={containerRef}
        className="overflow-y-scroll snap-y snap-mandatory scroll-smooth bg-background"
        style={{ 
          height: "calc(100vh - 4rem)",
          scrollbarWidth: "none", 
          msOverflowStyle: "none" 
        }}
      >
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {reels.map((reel, index) => (
          <div
            key={reel.id}
            className="snap-start snap-always"
            style={{ height: "calc(100vh - 4rem)" }}
          >
            <ReelCard
              reel={reel}
              onUpdate={fetchReels}
              isActive={index === currentIndex}
            />
          </div>
        ))}
      </div>
      
      <BottomNav />
    </div>
  );
}
