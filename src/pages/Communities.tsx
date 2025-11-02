import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function Communities() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommunities(data || []);
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [user]);


  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8 space-y-3 sm:space-y-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Creative Communities</h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Connect with passionate groups hosting amazing experiences across India
          </p>
        </div>

        {/* Communities Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">Loading communities...</p>
            </div>
          ) : communities.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">No communities yet. Be the first to create one!</p>
            </div>
          ) : (
            communities.map((community, index) => (
            <div
              key={index}
              className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
            >
                {/* Banner Image */}
                <div className="relative h-36 sm:h-44 overflow-hidden bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20">
                  {community.banner_image ? (
                    <img 
                      src={community.banner_image} 
                      alt={community.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="h-12 w-12 sm:h-16 sm:w-16 text-primary/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>

                {/* Community Info */}
                <div className="p-4 sm:p-6 space-y-2 sm:space-y-3 flex-1 flex flex-col">
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">
                      {community.name}
                    </h3>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {community.categories?.map((cat: string) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {community.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                      {community.description}
                    </p>
                  )}

                  <Button
                    className="w-full mt-auto" 
                    variant="outline"
                    onClick={() => navigate(`/community/${community.id}`)}
                  >
                    <span className="text-sm sm:text-base">View Community</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CTA Section - Hidden as communities are created from profile */}
      </div>

      <BottomNav />
    </div>
  );
}