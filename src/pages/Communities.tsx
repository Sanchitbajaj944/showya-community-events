import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin, CheckCircle, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreateCommunityDialog } from "@/components/CreateCommunityDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Communities() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<any[]>([]);
  const [userCommunity, setUserCommunity] = useState<any>(null);
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

      // Check if user has a community
      if (user) {
        const userComm = data?.find(c => c.owner_id === user.id);
        setUserCommunity(userComm || null);
      }
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

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">Creative Communities</h1>
          <p className="text-muted-foreground text-lg">
            Connect with passionate groups hosting amazing experiences across India
          </p>
        </div>

        {/* User's Community Status */}
        {user && userCommunity && (
          <Alert className="mb-6">
            <AlertDescription className="flex items-center justify-between">
              <div>
                <strong>Your Community:</strong> {userCommunity.name}
              </div>
              {getKycStatusBadge(userCommunity.kyc_status)}
            </AlertDescription>
          </Alert>
        )}

        {/* Communities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              className="group rounded-xl border border-border bg-card p-6 hover:shadow-lg transition-all duration-300"
            >
                {/* Community Avatar */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>

                {/* Community Info */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                      {community.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {community.category}
                      </Badge>
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

                  <Button className="w-full mt-4" variant="outline">
                    View Community
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CTA Section */}
        {user && !userCommunity && (
          <div className="mt-12 text-center p-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border">
            <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-2xl font-bold mb-2">Start Your Own Community</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Have a passion you want to share? Create your own community and bring people together around what you love.
            </p>
            <CreateCommunityDialog onSuccess={fetchCommunities}>
              <Button size="lg">Create Community</Button>
            </CreateCommunityDialog>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}