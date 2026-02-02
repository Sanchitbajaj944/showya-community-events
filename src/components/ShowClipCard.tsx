import { Eye, Trophy, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ShowClipCardProps {
  clip: {
    id: string;
    video_url: string | null;
    thumbnail_url: string | null;
    caption: string | null;
    view_count: number;
    community_name: string;
    is_winner_spotlight: boolean;
    reward_text: string | null;
  };
  onClick: () => void;
}

export function ShowClipCard({ clip, onClick }: ShowClipCardProps) {
  // Generate thumbnail from video URL or use provided thumbnail
  const thumbnailUrl = clip.thumbnail_url || clip.video_url;

  return (
    <div
      onClick={onClick}
      className="relative flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(50%-10px)] md:w-52 lg:w-56 cursor-pointer group snap-start"
    >
      {/* Thumbnail Container - 4:5 aspect ratio */}
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-muted">
        {thumbnailUrl ? (
          <video
            src={thumbnailUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
            onMouseEnter={(e) => {
              const video = e.currentTarget;
              video.currentTime = 0;
              video.play().catch(() => {});
            }}
            onMouseLeave={(e) => {
              const video = e.currentTarget;
              video.pause();
              video.currentTime = 0;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <Play className="h-8 w-8 text-primary/50" />
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        
        {/* Play icon on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="h-6 w-6 text-white fill-white" />
          </div>
        </div>

        {/* Winner Badge */}
        {clip.is_winner_spotlight && (
          <Badge 
            className="absolute top-2 left-2 bg-amber-500/90 text-amber-950 text-[10px] px-1.5 py-0.5 gap-0.5"
          >
            <Trophy className="h-2.5 w-2.5" />
            Winner
          </Badge>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-2 space-y-1">
          <p className="text-white text-xs font-medium truncate">
            {clip.community_name}
          </p>
          <div className="flex items-center gap-1 text-white/80">
            <Eye className="h-3 w-3" />
            <span className="text-[10px]">
              {clip.view_count >= 1000 
                ? `${(clip.view_count / 1000).toFixed(1)}k` 
                : clip.view_count}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
