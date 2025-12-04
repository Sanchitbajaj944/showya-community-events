import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface CommunityCardProps {
  community: any;
  variant?: "default" | "featured";
  showManage?: boolean;
  isMember?: boolean;
}

export const CommunityCard = ({ community, variant = "default", showManage = false, isMember = false }: CommunityCardProps) => {
  const navigate = useNavigate();
  
  const isFeatured = variant === "featured";
  
  // Navigate to member view if user is a member, otherwise public view
  const viewPath = isMember 
    ? `/community/${community.id}/member` 
    : `/community/${community.id}/public`;

  return (
    <div
      className={`group rounded-xl border bg-card overflow-hidden hover:shadow-xl transition-all duration-300 ${
        isFeatured ? "border-2 border-primary" : "border-border hover:shadow-lg"
      } flex flex-col`}
    >
      {/* Banner Image */}
      <div className={`relative overflow-hidden bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 ${
        isFeatured ? "h-44 sm:h-52" : "h-36 sm:h-44"
      }`}>
        {community.banner_url ? (
          <img 
            src={community.banner_url} 
            alt={community.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users className={`text-primary/40 ${
              isFeatured ? "h-16 w-16 sm:h-20 sm:w-20" : "h-12 w-12 sm:h-16 sm:w-16"
            }`} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Community Info */}
      <div className={`flex-1 flex flex-col ${
        isFeatured ? "p-6 sm:p-8" : "p-4 sm:p-6"
      }`}>
        <div className={isFeatured ? "space-y-4" : "space-y-2 sm:space-y-3"}>
          <div>
            <h3 className={`font-semibold mb-2 group-hover:text-primary transition-colors ${
              isFeatured 
                ? "text-xl sm:text-2xl font-bold mb-3" 
                : "text-base sm:text-lg line-clamp-1"
            }`}>
              {community.name}
            </h3>
            <div className={`flex flex-wrap mb-2 ${isFeatured ? "gap-2 mb-3" : "gap-1"}`}>
              {community.categories?.map((cat: string) => (
                <Badge 
                  key={cat} 
                  variant="secondary" 
                  className={isFeatured ? "text-sm" : "text-xs"}
                >
                  {cat}
                </Badge>
              ))}
            </div>
            {community.owner && (
              <p className={`text-muted-foreground ${isFeatured ? "text-sm" : "text-xs"}`}>
                by {community.owner.display_name || community.owner.name}
              </p>
            )}
          </div>

          {community.description && (
            <p className={`text-muted-foreground ${
              isFeatured ? "text-base" : "text-sm line-clamp-2"
            }`}>
              {community.description}
            </p>
          )}
        </div>
        
        <div className="flex-1 min-h-4" />

        {isFeatured && showManage ? (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              className="flex-1" 
              onClick={() => navigate(`/community/${community.id}`)}
            >
              Go to Dashboard
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => navigate(`/community/${community.id}/public`)}
            >
              View Public Page
            </Button>
          </div>
        ) : (
          <Button
            className="w-full mt-auto" 
            variant="outline"
            onClick={() => navigate(viewPath)}
          >
            <span className={isFeatured ? "text-base" : "text-sm sm:text-base"}>
              View Community
            </span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default CommunityCard;
