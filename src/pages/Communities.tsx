import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin, CheckCircle, Clock, XCircle } from "lucide-react";
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

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            KYC Approved
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            KYC In Progress
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            <XCircle className="h-3 w-3 mr-1" />
            KYC Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            KYC Not Started
          </Badge>
        );
    }
  };

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
              className="group rounded-xl border border-border bg-card p-4 sm:p-6 hover:shadow-lg transition-all duration-300"
            >
                {/* Community Avatar */}
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-3 sm:mb-4">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                </div>

                {/* Community Info */}
                <div className="space-y-2 sm:space-y-3">
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg mb-1 group-hover:text-primary transition-colors">
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
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {community.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {getKycStatusBadge(community.kyc_status)}
                  </div>

                  <Button 
                    className="w-full mt-3 sm:mt-4" 
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