import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ReelCard } from "@/components/ReelCard";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

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

// Generate a session ID for anonymous users
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('showclip_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem('showclip_session_id', sessionId);
  }
  return sessionId;
};

export default function ShowClipsViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [clips, setClips] = useState<ShowClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const clipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const viewedClips = useRef<Set<string>>(new Set());

  const startClipId = searchParams.get('start');
  const startIndex = parseInt(searchParams.get('index') || '0', 10);

  // Fetch clips with pagination
  const fetchClips = useCallback(async (offsetValue: number, append: boolean = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const { data, error } = await supabase
        .rpc('get_ranked_showclips', { p_limit: 20, p_offset: offsetValue });

      if (error) {
        console.error("Error fetching showclips:", error);
        // Fallback query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("spotlights")
          .select("*")
          .not("video_url", "is", null)
          .order("created_at", { ascending: false })
          .range(offsetValue, offsetValue + 19);
        
        if (fallbackError) throw fallbackError;
        
        const mappedData = (fallbackData || []).map(clip => ({
          ...clip,
          score: 0,
          community_id: clip.community_id || null,
          reward_text: clip.reward_text || null,
          is_winner_spotlight: clip.is_winner_spotlight || false,
          thumbnail_url: clip.thumbnail_url || null
        }));
        
        if (append) {
          setClips(prev => [...prev, ...mappedData]);
        } else {
          setClips(mappedData);
        }
        setHasMore(mappedData.length === 20);
      } else {
        if (append) {
          setClips(prev => [...prev, ...(data || [])]);
        } else {
          setClips(data || []);
        }
        setHasMore((data || []).length === 20);
      }
    } catch (error) {
      console.error("Error fetching showclips:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchClips(0);
  }, [fetchClips]);

  // Scroll to start clip when loaded
  useEffect(() => {
    if (!loading && clips.length > 0 && startIndex > 0) {
      const targetRef = clipRefs.current[startIndex];
      if (targetRef) {
        targetRef.scrollIntoView({ behavior: 'auto' });
        setCurrentIndex(startIndex);
      }
    }
  }, [loading, clips.length, startIndex]);

  // Intersection observer for tracking current clip
  useEffect(() => {
    const options = {
      root: containerRef.current,
      rootMargin: '0px',
      threshold: 0.5,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = clipRefs.current.findIndex((ref) => ref === entry.target);
          if (index !== -1) {
            setCurrentIndex(index);
            
            // Load more when near the end
            if (index >= clips.length - 5 && hasMore && !loadingMore) {
              const newOffset = offset + 20;
              setOffset(newOffset);
              fetchClips(newOffset, true);
            }
          }
        }
      });
    }, options);

    clipRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      observer.disconnect();
    };
  }, [clips.length, hasMore, loadingMore, offset, fetchClips]);

  // Debounced view tracking (2 seconds)
  useEffect(() => {
    if (clips.length === 0) return;
    
    const currentClip = clips[currentIndex];
    if (!currentClip || viewedClips.current.has(currentClip.id)) return;

    // Clear any existing timer for this clip
    const existingTimer = viewTimers.current.get(currentClip.id);
    if (existingTimer) clearTimeout(existingTimer);

    // Set new timer
    const timer = setTimeout(async () => {
      if (viewedClips.current.has(currentClip.id)) return;
      
      viewedClips.current.add(currentClip.id);
      
      try {
        await supabase.rpc('record_showclip_view', {
          p_showclip_id: currentClip.id,
          p_user_id: user?.id || null,
          p_session_id: user ? null : getSessionId()
        });
      } catch (error) {
        console.error('Error recording view:', error);
      }
    }, 2000);

    viewTimers.current.set(currentClip.id, timer);

    return () => {
      clearTimeout(timer);
    };
  }, [currentIndex, clips, user]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      viewTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleRefresh = () => {
    fetchClips(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-xl text-muted-foreground mb-2">No ShowClips yet</p>
        <p className="text-sm text-muted-foreground mb-4">
          Be the first to share a performance highlight!
        </p>
        <Button onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <div className="fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          className="bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Fullscreen vertical scroll container */}
      <div
        ref={containerRef}
        className="overflow-y-scroll snap-y snap-mandatory scroll-smooth h-screen"
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
        
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            ref={(el) => (clipRefs.current[index] = el)}
            className="snap-start snap-always h-screen"
          >
            <ReelCard
              reel={{
                id: clip.id,
                video_url: clip.video_url,
                caption: clip.caption,
                view_count: clip.view_count,
                like_count: clip.like_count,
                community_name: clip.community_name,
                feature_text: clip.feature_text,
                event_id: clip.event_id,
                user_id: clip.user_id
              }}
              onUpdate={handleRefresh}
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
    </div>
  );
}
