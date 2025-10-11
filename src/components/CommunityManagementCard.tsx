import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle, Clock, XCircle, Plus } from "lucide-react";
import { CreateCommunityDialog } from "./CreateCommunityDialog";

interface CommunityManagementCardProps {
  community: any;
  onCommunityCreated: () => void;
}

export const CommunityManagementCard = ({ community, onCommunityCreated }: CommunityManagementCardProps) => {
  const navigate = useNavigate();
  
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

  if (!community) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Start Your Community</h3>
              <p className="text-sm text-muted-foreground">
                Create your own community and host amazing events
              </p>
            </div>
            <CreateCommunityDialog onSuccess={onCommunityCreated}>
              <Button size="lg" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create Community
              </Button>
            </CreateCommunityDialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{community.name}</h3>
                  <p className="text-xs text-muted-foreground">Your Community</p>
                </div>
              </div>
            </div>
            {getKycStatusBadge(community.kyc_status)}
          </div>

          {community.categories && community.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {community.categories.map((cat: string) => (
                <Badge key={cat} variant="secondary" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          )}

          {community.description && (
            <p className="text-sm text-muted-foreground">
              {community.description}
            </p>
          )}

          <div className="pt-4 border-t border-border space-y-2">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate(`/community/${community.id}`)}
            >
              Manage Community
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-xs"
              onClick={() => navigate(`/community/${community.id}/public`)}
            >
              View Public Profile
            </Button>
          </div>

          {community.kyc_status === 'NOT_STARTED' && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                💡 Complete KYC verification to accept payments for paid events
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
