import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ReelCard } from "@/components/ReelCard";
import { Loader2 } from "lucide-react";

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
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReels();
  }, []);

  const fetchReels = async () => {
    try {
      const { data, error } = await supabase
        .from("spotlights")
        .select("*")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReels(data || []);
    } catch (error) {
      console.error("Error fetching reels:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-20 md:pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Reels</h1>
            <p className="text-muted-foreground">
              Watch spotlight performances from our amazing community
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : reels.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl text-muted-foreground mb-2">No reels yet</p>
              <p className="text-sm text-muted-foreground">
                Be the first to upload a spotlight reel!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reels.map((reel) => (
                <ReelCard key={reel.id} reel={reel} onUpdate={fetchReels} />
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
