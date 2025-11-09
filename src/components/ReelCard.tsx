import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Heart, Eye, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
}

export function ReelCard({ reel, onUpdate }: ReelCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [performerData, setPerformerData] = useState<{
    name: string;
    display_name: string | null;
    profile_picture_url: string | null;
  } | null>(null);

  useEffect(() => {
    fetchPerformerData();
  }, [reel.user_id]);

  const fetchPerformerData = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("name, display_name, profile_picture_url")
        .eq("user_id", reel.user_id)
        .maybeSingle();
      
      if (data) {
        setPerformerData(data);
      }
    } catch (error) {
      console.error("Error fetching performer data:", error);
    }
  };

  const handlePlay = async () => {
    setIsPlaying(true);
    
    // Increment view count on first play
    if (!hasViewed) {
      setHasViewed(true);
      const { error } = await supabase
        .from("spotlights")
        .update({ view_count: reel.view_count + 1 })
        .eq("id", reel.id);
      
      if (!error && onUpdate) {
        onUpdate();
      }
    }
  };

  const performerName = performerData?.display_name || performerData?.name || "Unknown Performer";

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        {/* Video Container */}
        <div className="relative aspect-[9/16] bg-muted">
          {reel.video_url ? (
            <>
              <video
                src={reel.video_url}
                className="w-full h-full object-cover"
                controls={isPlaying}
                onPlay={handlePlay}
                poster={performerData?.profile_picture_url || undefined}
              />
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="w-16 h-16 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-colors"
                  >
                    <Play className="h-8 w-8 text-primary-foreground ml-1" fill="currentColor" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-muted-foreground">No video</p>
            </div>
          )}

          {/* Stats Overlay */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
              <Heart className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-medium">{reel.like_count}</span>
            </div>
            <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
              <Eye className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-medium">{reel.view_count}</span>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="p-4 space-y-3">
          {/* Performer Info */}
          <Link to={`/profile/${reel.user_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <UserAvatar
              name={performerName}
              src={performerData?.profile_picture_url}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{performerName}</p>
              <p className="text-xs text-muted-foreground">Spotlight Performer</p>
            </div>
          </Link>

          {/* Community Badge */}
          <Link to={`/communities`}>
            <Badge variant="secondary" className="hover:bg-secondary/80 transition-colors">
              {reel.community_name}
            </Badge>
          </Link>

          {/* Caption */}
          {reel.caption && (
            <p className="text-sm text-foreground line-clamp-2">{reel.caption}</p>
          )}

          {/* Feature Text */}
          {reel.feature_text && (
            <p className="text-xs text-muted-foreground italic line-clamp-1">
              {reel.feature_text}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
