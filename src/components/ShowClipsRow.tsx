import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShowClipCard } from "./ShowClipCard";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ShowClip {
  id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  view_count: number;
  like_count: number;
  community_name: string;
  community_id: string | null;
  feature_text: string;
  event_id: string | null;
  user_id: string;
  reward_text: string | null;
  is_winner_spotlight: boolean;
  created_at: string;
  score: number;
}

export function ShowClipsRow() {
  const [clips, setClips] = useState<ShowClip[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchShowClips();
  }, []);

  const fetchShowClips = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_ranked_showclips', { p_limit: 20, p_offset: 0 });

      if (error) {
        console.error("Error fetching showclips:", error);
        // Fallback to direct query if function not available
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("spotlights")
          .select("*")
          .not("video_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(20);
        
        if (fallbackError) throw fallbackError;
        setClips((fallbackData || []).map(clip => ({
          ...clip,
          score: 0,
          community_id: clip.community_id || null,
          reward_text: clip.reward_text || null,
          is_winner_spotlight: clip.is_winner_spotlight || false,
          thumbnail_url: clip.thumbnail_url || null
        })));
      } else {
        setClips(data || []);
      }
    } catch (error) {
      console.error("Error fetching showclips:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClipClick = (clipId: string, index: number) => {
    navigate(`/showclips?start=${clipId}&index=${index}`);
  };

  if (loading) {
    return (
      <section className="py-8 sm:py-12">
        <div className="container px-4 md:px-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              <h2 className="text-xl sm:text-2xl font-bold">ShowClips</h2>
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="w-40 h-56 rounded-xl flex-shrink-0" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (clips.length === 0) {
    return null;
  }

  return (
    <section className="py-8 sm:py-12">
      <div className="container px-4 md:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary fill-primary" />
            <h2 className="text-xl sm:text-2xl font-bold">ShowClips</h2>
          </div>
          <Link to="/showclips">
            <Button variant="ghost" size="sm" className="gap-1">
              See all
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        
        <div 
          ref={scrollContainerRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <style>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {clips.map((clip, index) => (
            <ShowClipCard
              key={clip.id}
              clip={clip}
              onClick={() => handleClipClick(clip.id, index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
