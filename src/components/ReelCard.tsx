import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Heart, Volume2, VolumeX, Share2, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

export function ReelCard({ reel, onUpdate, isActive }: ReelCardProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [hasViewed, setHasViewed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(reel.like_count);
  const [performerData, setPerformerData] = useState<{
    name: string;
    display_name: string | null;
    profile_picture_url: string | null;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchPerformerData();
  }, [reel.user_id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.play().catch(() => {});
      // Track view on first play
      if (!hasViewed) {
        setHasViewed(true);
        supabase
          .from("spotlights")
          .update({ view_count: reel.view_count + 1 })
          .eq("id", reel.id)
          .then(({ error }) => {
            if (!error && onUpdate) onUpdate();
          });
      }
    } else {
      video.pause();
    }
  }, [isActive]);

  const fetchPerformerData = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("name, display_name, profile_picture_url")
        .eq("user_id", reel.user_id)
        .maybeSingle();
      
      if (data) setPerformerData(data);
    } catch (error) {
      console.error("Error fetching performer data:", error);
    }
  };

  const handleLike = async () => {
    const newLikeState = !isLiked;
    setIsLiked(newLikeState);
    setLocalLikes(prev => newLikeState ? prev + 1 : prev - 1);

    const { error } = await supabase
      .from("spotlights")
      .update({ like_count: newLikeState ? reel.like_count + 1 : reel.like_count - 1 })
      .eq("id", reel.id);

    if (error) {
      setIsLiked(!newLikeState);
      setLocalLikes(prev => newLikeState ? prev - 1 : prev + 1);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${reel.event_id}`;
    try {
      await navigator.share({
        title: reel.feature_text,
        text: reel.caption || "",
        url,
      });
    } catch {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  const performerName = performerData?.display_name || performerData?.name || "Unknown Performer";

  return (
    <div className="relative h-full w-full bg-black">
      {/* Video Player */}
      <video
        ref={videoRef}
        src={reel.video_url || ""}
        className="h-full w-full object-contain"
        loop
        muted={isMuted}
        playsInline
        onClick={() => videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause()}
      />

      {/* Bottom Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-20 md:pb-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-end gap-4">
          {/* Left: User Info & Caption */}
          <div className="flex-1 space-y-3">
            <Link to={`/profile/${reel.user_id}`} className="flex items-center gap-3">
              <UserAvatar
                name={performerName}
                src={performerData?.profile_picture_url}
                size="md"
                className="border-2 border-white"
              />
              <div>
                <p className="font-semibold text-white text-sm">@{performerName}</p>
                <p className="text-xs text-white/80">Spotlight Performer</p>
              </div>
            </Link>

            <div className="space-y-1">
              {reel.feature_text && (
                <p className="text-white font-medium text-sm">{reel.feature_text}</p>
              )}
              {reel.caption && (
                <p className="text-white/90 text-sm line-clamp-2">{reel.caption}</p>
              )}
            </div>

            <Link to={`/communities`}>
              <Badge className="bg-primary/90 hover:bg-primary text-primary-foreground">
                {reel.community_name}
              </Badge>
            </Link>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-col gap-6 items-center">
            <button
              onClick={handleLike}
              className="flex flex-col items-center gap-1"
            >
              <div className={`p-3 rounded-full transition-all ${isLiked ? 'bg-primary' : 'bg-white/20 backdrop-blur-sm'}`}>
                <Heart 
                  className={`h-6 w-6 ${isLiked ? 'text-white fill-current' : 'text-white'}`} 
                />
              </div>
              <span className="text-white text-xs font-medium">{localLikes}</span>
            </button>

            <button onClick={handleShare} className="flex flex-col items-center gap-1">
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Share2 className="h-6 w-6 text-white" />
              </div>
              <span className="text-white text-xs font-medium">Share</span>
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="flex flex-col items-center gap-1"
            >
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                {isMuted ? (
                  <VolumeX className="h-6 w-6 text-white" />
                ) : (
                  <Volume2 className="h-6 w-6 text-white" />
                )}
              </div>
            </button>

            <button className="flex flex-col items-center gap-1">
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <MoreVertical className="h-6 w-6 text-white" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
