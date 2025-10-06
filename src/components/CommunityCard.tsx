import { Users, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CommunityCardProps {
  name: string;
  description: string;
  members: number;
  upcomingEvents: number;
  image?: string;
}

const CommunityCard = ({
  name,
  description,
  members,
  upcomingEvents,
  image,
}: CommunityCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-hover transition-all duration-300 cursor-pointer group h-full flex flex-col">
      <div className="relative h-40 overflow-hidden bg-gradient-card">
        {image ? (
          <img src={image} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-gradient-card" />
        )}
      </div>
      <CardContent className="p-5 flex-1 flex flex-col">
        <h3 className="font-semibold text-xl mb-2 group-hover:text-primary transition-colors">
          {name}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
          {description}
        </p>
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{members} members</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>{upcomingEvents} events</span>
          </div>
        </div>
        <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          Follow
        </Button>
      </CardContent>
    </Card>
  );
};

export default CommunityCard;
