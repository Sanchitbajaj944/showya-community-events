import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Heart, Volume2, VolumeX, Share2, MoreVertical, Loader2 } from "lucide-react";
import { BlueTick } from "@/components/BlueTick";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
interface ReelCardProps {
  reel: {
    id: string;
    video_url: string | null;
    caption: string | null;
    view_count: number;
    like_count: number;
    community_name: string;
    feature_text: string;
    event_id: string | null;
    user_id: string;
  };
  onUpdate?: () => void;
  isActive: boolean;
}
export function ReelCard({
  reel,
  onUpdate,
  isActive
}: ReelCardProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(reel.like_count);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [communityBanner, setCommunityBanner] = useState<string | null>(null);
  const [isBlueTick, setIsBlueTick] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [performerData, setPerformerData] = useState<{
    name: string;
    display_name: string | null;
    profile_picture_url: string | null;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    user
  } = useAuth();
  useEffect(() => {
    fetchCommunityId();
    fetchPerformerData();
    if (user) {
      checkIfLiked();
    }
  }, [reel.user_id, reel.community_name, user]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleWaiting = () => {
      if (isActive) setIsLoading(true);
    };
    const handleCanPlay = () => setIsLoading(false);
    const handlePlaying = () => setIsLoading(false);
    const handleLoadedData = () => setIsLoading(false);
    const handleError = () => {
      setIsLoading(false);
      console.error('Video loading error');
    };
    
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    if (isActive) {
      // Reset to beginning and play
      video.currentTime = 0;
      video.muted = false;
      setIsMuted(false);
      
      // Only show loading if video isn't ready
      if (video.readyState < 3) {
        setIsLoading(true);
      }
      
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error('Play failed:', error);
          setIsLoading(false);
        });
      }
      
      // Track view on first play
      if (!hasViewed) {
        setHasViewed(true);
        supabase.from("spotlights").update({
          view_count: reel.view_count + 1
        }).eq("id", reel.id).then(({
          error
        }) => {
          if (!error && onUpdate) onUpdate();
        });
      }
    } else {
      // Stop, mute, and reset when scrolling away - don't show loading
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      setIsMuted(true);
      setIsLoading(false);
    }
    
    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, [isActive]);
  const checkIfLiked = async () => {
    if (!user) return;
    const {
      data
    } = await supabase.from("spotlight_likes").select("id").eq("spotlight_id", reel.id).eq("user_id", user.id).maybeSingle();
    setIsLiked(!!data);
  };
  const fetchCommunityId = async () => {
    try {
      const {
        data
      } = await supabase.from("communities").select("id, banner_url, is_blue_tick").eq("name", reel.community_name).maybeSingle();
      if (data) {
        setCommunityId(data.id);
        setCommunityBanner(data.banner_url);
        setIsBlueTick(data.is_blue_tick || false);

        // Check if user is a member
        if (user) {
          const {
            data: memberData
          } = await supabase.from("community_members").select("id").eq("community_id", data.id).eq("user_id", user.id).maybeSingle();
          setIsMember(!!memberData);
        }
      }
    } catch (error) {
      console.error("Error fetching community ID:", error);
    }
  };
  const fetchPerformerData = async () => {
    try {
      const {
        data
      } = await supabase.from("profiles").select("name, display_name, profile_picture_url").eq("user_id", reel.user_id).maybeSingle();
      if (data) setPerformerData(data);
    } catch (error) {
      console.error("Error fetching performer data:", error);
    }
  };
  const handleLike = async () => {
    if (!user) {
      toast.error("Please sign in to like ShowClips");
      return;
    }
    const newLikeState = !isLiked;
    const previousLikeState = isLiked;
    const previousLikeCount = localLikes;

    // Optimistic update
    setIsLiked(newLikeState);
    setLocalLikes(prev => newLikeState ? prev + 1 : Math.max(0, prev - 1));
    try {
      if (newLikeState) {
        // Add like
        const {
          error
        } = await supabase.from("spotlight_likes").insert({
          spotlight_id: reel.id,
          user_id: user.id
        });
        if (error) throw error;
      } else {
        // Remove like
        const {
          error
        } = await supabase.from("spotlight_likes").delete().eq("spotlight_id", reel.id).eq("user_id", user.id);
        if (error) throw error;
      }

      // Refresh the reel data to get accurate count
      if (onUpdate) onUpdate();
    } catch (error: any) {
      console.error("Error toggling like:", error);
      // Revert on error
      setIsLiked(previousLikeState);
      setLocalLikes(previousLikeCount);
      if (error.code === '23505') {
        toast.error("You've already liked this ShowClip");
      } else {
        toast.error("Failed to update like");
      }
    }
  };
  const handleShare = async () => {
    const url = `${window.location.origin}/events/${reel.event_id}`;
    try {
      await navigator.share({
        title: reel.feature_text,
        text: reel.caption || "",
        url
      });
    } catch {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };
  const performerName = performerData?.display_name || performerData?.name || "Unknown Performer";
  return <div className="relative h-full w-full bg-background">
      {/* Video Player */}
      <video 
        ref={videoRef} 
        src={reel.video_url || ""} 
        className="h-full w-full object-contain" 
        loop 
        muted={isMuted} 
        playsInline 
        preload="auto"
        webkit-playsinline="true"
        onClick={() => videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause()} 
      />

      {/* Loading Indicator */}
      {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-sm">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>}

      {/* Bottom Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 pb-20 md:pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-end gap-3">
          {/* Left: User Info & Caption */}
          <div className="flex-1 space-y-2">
            {/* Community Info First */}
            <Link to={communityId ? isMember ? `/community/${communityId}` : `/community/${communityId}/public` : `/communities`} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-primary flex items-center justify-center border border-white">
                {communityBanner ? <img src={communityBanner} alt={reel.community_name} className="w-full h-full object-cover" /> : <span className="text-white font-bold text-xs">
                    {reel.community_name.charAt(0).toUpperCase()}
                  </span>}
              </div>
              <div>
                <p className="font-semibold text-white text-xs flex items-center gap-1">
                  {reel.community_name}
                  {isBlueTick && <BlueTick size="sm" className="text-blue-400 fill-blue-400/20" />}
                </p>
                <p className="text-[10px] text-white/80">Community</p>
              </div>
            </Link>

            {/* Spotlight Performer */}
            <Link to={`/profile/${reel.user_id}`} className="flex items-center gap-2">
              <UserAvatar name={performerName} src={performerData?.profile_picture_url} size="sm" className="border border-white" />
              <div>
                <p className="font-semibold text-white text-xs">@{performerName}</p>
                <p className="text-[10px] text-white/80">Spotlight Performer</p>
              </div>
            </Link>

            {/* Feature Text & Caption */}
            <div className="space-y-0.5">
              {reel.feature_text && <p className="text-white font-medium text-xs">{reel.feature_text}</p>}
              {reel.caption && <p className="text-white/90 text-xs line-clamp-2">{reel.caption}</p>}
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-col gap-4 items-center">
            <button onClick={handleLike} className="flex flex-col items-center gap-0.5">
              <div className={`p-2 rounded-full transition-all ${isLiked ? 'bg-primary' : 'bg-white/20 backdrop-blur-sm'}`}>
                <Heart className={`h-5 w-5 ${isLiked ? 'text-white fill-current' : 'text-white'}`} />
              </div>
              <span className="text-white text-[10px] font-medium">{localLikes}</span>
            </button>

            <button onClick={handleShare} className="flex flex-col items-center gap-0.5">
              <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-white text-[10px] font-medium">Share</span>
            </button>

            <button onClick={() => setIsMuted(!isMuted)} className="flex flex-col items-center gap-0.5">
              <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
                {isMuted ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
              </div>
            </button>

            <button className="flex flex-col items-center gap-0.5">
              
            </button>
          </div>
        </div>
      </div>
    </div>;
}