import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunityOverview } from "@/components/community/CommunityOverview";
import { CommunityMembers } from "@/components/community/CommunityMembers";
import { CommunityEvents } from "@/components/community/CommunityEvents";
import { CommunityChat } from "@/components/community/CommunityChat";
import { CommunityPayouts } from "@/components/community/CommunityPayouts";
import { CommunitySettings } from "@/components/community/CommunitySettings";
import { toast } from "sonner";

export default function CommunityDashboard() {
  const { communityId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'member' | 'public'>('public');

  useEffect(() => {
    if (!user) {
      navigate("/auth/signin");
      return;
    }
    fetchCommunityData();
  }, [communityId, user]);

  const fetchCommunityData = async () => {
    if (!communityId || !user) return;

    try {
      setLoading(true);

      // Fetch community
      const { data: communityData, error: communityError } = await supabase
        .from("communities")
        .select("*")
        .eq("id", communityId)
        .single();

      if (communityError) throw communityError;
      setCommunity(communityData);

      // Check if user is a member
      const { data: memberData } = await supabase
        .from("community_members")
        .select("role")
        .eq("community_id", communityId)
        .eq("user_id", user.id)
        .single();

      // Determine user role
      if (communityData.owner_id === user.id) {
        setUserRole('owner');
      } else if (memberData) {
        setUserRole('member');
      } else {
        setUserRole('public');
      }
    } catch (error: any) {
      console.error("Error fetching community:", error);
      toast.error("Failed to load community");
      navigate("/communities");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading community...</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg">Community not found</p>
        </div>
      </div>
    );
  }

  // Redirect to appropriate view based on role
  if (userRole === 'public') {
    window.location.href = `/community/${communityId}/public`;
    return null;
  }

  if (userRole === 'member') {
    window.location.href = `/community/${communityId}/member`;
    return null;
  }

  // Owner view
  if (userRole === 'owner') {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <Header />
        
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 lg:w-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <CommunityOverview community={community} userRole={userRole} />
            </TabsContent>

            <TabsContent value="members">
              <CommunityMembers community={community} userRole={userRole} />
            </TabsContent>

            <TabsContent value="events">
              <CommunityEvents community={community} userRole={userRole} />
            </TabsContent>

            <TabsContent value="chat">
              <CommunityChat community={community} userRole={userRole} />
            </TabsContent>

            <TabsContent value="payouts">
              <CommunityPayouts community={community} onRefresh={fetchCommunityData} />
            </TabsContent>

            <TabsContent value="settings">
              <CommunitySettings community={community} onUpdate={fetchCommunityData} />
            </TabsContent>
          </Tabs>
        </div>

        <BottomNav />
      </div>
    );
  }

  // Member/Public view will be implemented later
  return null;
}
