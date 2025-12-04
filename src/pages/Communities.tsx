import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { CommunityCard } from "@/components/CommunityCard";

interface CommunityWithOwner {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  categories: string[];
  owner_id: string;
  created_at: string;
  updated_at: string;
  kyc_status: string;
  platform_fee_percentage: number;
  owner?: { name: string | null; display_name: string | null } | null;
}

export default function Communities() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allCommunities, setAllCommunities] = useState<CommunityWithOwner[]>([]);
  const [myCommunity, setMyCommunity] = useState<CommunityWithOwner | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<CommunityWithOwner[]>([]);
  const [exploreCommunities, setExploreCommunities] = useState<CommunityWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllJoined, setShowAllJoined] = useState(false);

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      // Fetch user's own community if logged in
      if (user) {
        const { data: ownCommunityData } = await supabase
          .from('communities')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle();
        
        let ownCommunity: CommunityWithOwner | null = ownCommunityData as CommunityWithOwner | null;
        
        // Fetch owner profile for own community
        if (ownCommunity) {
          const { data: ownerProfile } = await supabase
            .from('profiles_public')
            .select('name, display_name')
            .eq('user_id', ownCommunity.owner_id)
            .maybeSingle();
          ownCommunity.owner = ownerProfile;
        }
        
        setMyCommunity(ownCommunity);

        // Fetch communities user is a member of (but doesn't own)
        const { data: membershipData } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', user.id)
          .neq('role', 'owner');

        const joinedCommunityIds = membershipData?.map(m => m.community_id) || [];

        if (joinedCommunityIds.length > 0) {
          const { data: joinedData } = await supabase
            .from('communities')
            .select('*')
            .in('id', joinedCommunityIds)
            .order('created_at', { ascending: false });
          
          const joinedWithOwners: CommunityWithOwner[] = (joinedData || []) as CommunityWithOwner[];
          
          // Fetch owner profiles for joined communities
          if (joinedWithOwners.length > 0) {
            const ownerIds = [...new Set(joinedWithOwners.map(c => c.owner_id))];
            const { data: ownerProfiles } = await supabase
              .from('profiles_public')
              .select('user_id, name, display_name')
              .in('user_id', ownerIds);
            
            const ownerMap = new Map(ownerProfiles?.map(p => [p.user_id, p]) || []);
            joinedWithOwners.forEach(c => {
              c.owner = ownerMap.get(c.owner_id) || null;
            });
          }
          
          setJoinedCommunities(joinedWithOwners);
        }
      }

      // Fetch all communities
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const allData: CommunityWithOwner[] = (data || []) as CommunityWithOwner[];
      
      // Fetch owner profiles for all communities
      if (allData.length > 0) {
        const ownerIds = [...new Set(allData.map(c => c.owner_id))];
        const { data: ownerProfiles } = await supabase
          .from('profiles_public')
          .select('user_id, name, display_name')
          .in('user_id', ownerIds);
        
        const ownerMap = new Map(ownerProfiles?.map(p => [p.user_id, p]) || []);
        allData.forEach(c => {
          c.owner = ownerMap.get(c.owner_id) || null;
        });
      }
      
      setAllCommunities(allData);

      // Filter communities for "Explore" section
      if (user && allData) {
        const joinedIds = joinedCommunities.map(c => c.id);
        const explore = allData.filter(c => 
          c.owner_id !== user.id && 
          !joinedIds.includes(c.id)
        );
        
        setExploreCommunities(explore);
      } else {
        setExploreCommunities(allData);
      }
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [user?.id]);

  // Update explore communities when joined communities change
  useEffect(() => {
    if (user && allCommunities.length > 0) {
      const joinedIds = joinedCommunities.map(c => c.id);
      const explore = allCommunities.filter(c => 
        c.owner_id !== user.id && 
        !joinedIds.includes(c.id)
      );
      setExploreCommunities(explore);
    }
  }, [joinedCommunities, allCommunities, user]);

  const displayedJoinedCommunities = showAllJoined 
    ? joinedCommunities 
    : joinedCommunities.slice(0, 3);


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

        {/* My Community Section */}
        {myCommunity && (
          <div className="mb-8 sm:mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-bold">My Community</h2>
              <Button 
                onClick={() => navigate(`/community/${myCommunity.id}`)}
                size="sm"
              >
                Manage
              </Button>
            </div>
            <CommunityCard 
              community={myCommunity} 
              variant="featured" 
              showManage={true}
            />
          </div>
        )}

        {/* Joined Communities Section */}
        {user && joinedCommunities.length > 0 && (
          <div className="mb-8 sm:mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-bold">Joined Communities</h2>
              {joinedCommunities.length > 3 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAllJoined(!showAllJoined)}
                >
                  {showAllJoined ? (
                    <>Show Less <ChevronUp className="ml-2 h-4 w-4" /></>
                  ) : (
                    <>See All ({joinedCommunities.length}) <ChevronDown className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {displayedJoinedCommunities.map((community) => (
                <CommunityCard 
                  key={community.id} 
                  community={community}
                  isMember={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Explore Communities Section */}
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">
            Explore Communities
          </h2>
        </div>

        {/* Communities Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">Loading communities...</p>
            </div>
          ) : exploreCommunities.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                {user && (myCommunity || joinedCommunities.length > 0)
                  ? "You've explored all communities!"
                  : "No communities yet. Be the first to create one!"}
              </p>
            </div>
          ) : (
            exploreCommunities.map((community) => (
              <CommunityCard 
                key={community.id} 
                community={community}
              />
            ))
          )}
        </div>

        {/* CTA Section - Hidden as communities are created from profile */}
      </div>

      <BottomNav />
    </div>
  );
}