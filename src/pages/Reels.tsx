import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ReelCard } from "@/components/ReelCard";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

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
  score?: number;
}

// Generate a session ID for anonymous users
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('showclip_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem('showclip_session_id', sessionId);
  }
  return sessionId;
};

export default function Reels() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const viewedClips = useRef<Set<string>>(new Set());

  const startClipId = searchParams.get('start');
  const startIndex = parseInt(searchParams.get('index') || '0', 10);

  // Fetch reels with pagination using ranked query
  const fetchReels = useCallback(async (offsetValue: number = 0, append: boolean = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const { data, error } = await supabase
        .rpc('get_ranked_showclips', { p_limit: 20, p_offset: offsetValue });

      if (error) {
        console.error("Error fetching ranked showclips:", error);
        // Fallback to direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("spotlights")
          .select("*")
          .not("video_url", "is", null)
          .order("created_at", { ascending: false })
          .range(offsetValue, offsetValue + 19);

        if (fallbackError) throw fallbackError;
        
        if (append) {
          setReels(prev => [...prev, ...(fallbackData || [])]);
        } else {
          setReels(fallbackData || []);
        }
        setHasMore((fallbackData || []).length === 20);
      } else {
        if (append) {
          setReels(prev => [...prev, ...(data || [])]);
        } else {
          setReels(data || []);
        }
        setHasMore((data || []).length === 20);
      }
    } catch (error) {
      console.error("Error fetching reels:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchReels(0);
  }, [fetchReels]);

  // Scroll to start clip when loaded from home screen
  useEffect(() => {
    if (!loading && reels.length > 0 && startIndex > 0) {
      const targetRef = reelRefs.current[startIndex];
      if (targetRef) {
        targetRef.scrollIntoView({ behavior: 'auto' });
        setCurrentIndex(startIndex);
      }
    }
  }, [loading, reels.length, startIndex]);

  // Intersection observer for tracking current reel and infinite scroll
  useEffect(() => {
    const options = {
      root: containerRef.current,
      rootMargin: '0px',
      threshold: 0.5,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = reelRefs.current.findIndex((ref) => ref === entry.target);
          if (index !== -1) {
            setCurrentIndex(index);
            
            // Load more when near the end
            if (index >= reels.length - 5 && hasMore && !loadingMore) {
              const newOffset = offset + 20;
              setOffset(newOffset);
              fetchReels(newOffset, true);
            }
          }
        }
      });
    }, options);

    reelRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      observer.disconnect();
    };
  }, [reels.length, hasMore, loadingMore, offset, fetchReels]);

  // Debounced view tracking (2 seconds)
  useEffect(() => {
    if (reels.length === 0) return;
    
    const currentReel = reels[currentIndex];
    if (!currentReel || viewedClips.current.has(currentReel.id)) return;

    // Clear any existing timer for this clip
    const existingTimer = viewTimers.current.get(currentReel.id);
    if (existingTimer) clearTimeout(existingTimer);

    // Set new timer
    const timer = setTimeout(async () => {
      if (viewedClips.current.has(currentReel.id)) return;
      
      viewedClips.current.add(currentReel.id);
      
      try {
        await supabase.rpc('record_showclip_view', {
          p_showclip_id: currentReel.id,
          p_user_id: user?.id || null,
          p_session_id: user ? null : getSessionId()
        });
      } catch (error) {
        console.error('Error recording view:', error);
      }
    }, 2000);

    viewTimers.current.set(currentReel.id, timer);

    return () => {
      clearTimeout(timer);
    };
  }, [currentIndex, reels, user]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      viewTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="hidden md:block">
          <Header />
        </div>
        <div className="flex items-center justify-center h-screen md:h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="hidden md:block">
          <Header />
        </div>
        <div className="flex items-center justify-center h-screen md:h-[calc(100vh-4rem)]">
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
      <div className="hidden md:block">
        <Header />
      </div>
      
      {/* Reels Container with Snap Scroll */}
      <div
        ref={containerRef}
        className="overflow-y-scroll snap-y snap-mandatory scroll-smooth bg-background h-screen md:h-[calc(100vh-4rem)]"
        style={{ 
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
            ref={(el) => (reelRefs.current[index] = el)}
            className="snap-start snap-always h-screen md:h-[calc(100vh-4rem)]"
          >
            <ReelCard
              reel={reel}
              onUpdate={() => fetchReels(0)}
              isActive={index === currentIndex}
            />
          </div>
        ))}
        
        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      
      <BottomNav />
    </div>
  );
}
