import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, MessageCircle, Share2, LogOut, Info, CheckCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";

export default function CommunityMemberView() {
  const { communityId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [joinDate, setJoinDate] = useState<string>("");
  const [loading, setLoading] = useState(true);

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

      // Fetch owner profile
      const { data: ownerData } = await supabase
        .from("profiles")
        .select("display_name, name, profile_picture_url")
        .eq("user_id", communityData.owner_id)
        .single();

      setOwnerProfile(ownerData);

      // Fetch members
      const { data: membersData } = await supabase
        .from("community_members")
        .select(`
          *,
          profile:profiles!community_members_user_id_fkey(
            display_name,
            name,
            profile_picture_url
          )
        `)
        .eq("community_id", communityId);

      setMembers(membersData || []);

      // Get user's join date
      const userMember = membersData?.find(m => m.user_id === user.id);
      if (userMember) {
        setJoinDate(new Date(userMember.joined_at).toLocaleDateString());
      }
    } catch (error: any) {
      console.error("Error fetching community:", error);
      toast.error("Failed to load community");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !communityId) return;

    try {
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Left community");
      navigate("/communities");
    } catch (error: any) {
      console.error("Error leaving community:", error);
      toast.error("Failed to leave community");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: community.name,
          text: community.description,
          url: url,
        });
      } catch (error) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
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

  const ownerName = ownerProfile?.display_name || ownerProfile?.name || "Community Owner";

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {/* Community Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="w-full h-48 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 mb-6" />
            
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{community.name}</h1>
                  <p className="text-sm text-muted-foreground mb-3">
                    Hosted by @{ownerName}
                  </p>
                  {community.categories && community.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {community.categories.map((cat: string) => (
                        <Badge key={cat} variant="secondary">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {community.kyc_status === 'APPROVED' && (
                    <Badge variant="outline" className="border-green-500 text-green-500 mb-3">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified Host
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">
                      <LogOut className="h-4 w-4 mr-2" />
                      Leave Community
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave Community?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to leave this community? You'll need to rejoin to access events and chat.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLeave}>
                        Leave
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="about" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="about">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">
                    {community.description || "No description provided"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Members</p>
                    <p className="text-2xl font-bold">{members.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">You Joined</p>
                    <p className="text-2xl font-bold">{joinDate}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No upcoming events. Stay tuned!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>{members.length} Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted">
                      <UserAvatar
                        src={member.profile?.profile_picture_url}
                        name={member.profile?.display_name || member.profile?.name || "User"}
                        size="md"
                      />
                      <div className="flex-1">
                        <p className="font-medium">
                          {member.profile?.display_name || member.profile?.name || "User"}
                        </p>
                        {member.role === 'owner' && (
                          <Badge variant="secondary" className="text-xs">Owner</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Start a conversation!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
