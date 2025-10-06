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
    <Card className="overflow-hidden hover:shadow-glow transition-all duration-500 cursor-pointer group h-full flex flex-col border-2 hover:border-primary/50">
      <div className="relative h-44 overflow-hidden bg-gradient-card">
        {image ? (
          <img 
            src={image} 
            alt={name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-card flex items-center justify-center">
            <div className="text-6xl opacity-20">🎨</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      <CardContent className="p-6 flex-1 flex flex-col">
        <h3 className="font-bold text-xl mb-3 group-hover:text-gradient transition-all line-clamp-1">
          {name}
        </h3>
        <p className="text-sm text-muted-foreground mb-5 line-clamp-2 flex-1 leading-relaxed">
          {description}
        </p>
        <div className="flex items-center justify-between text-sm mb-5 pb-5 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-semibold">{members.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-secondary" />
            <span className="font-semibold">{upcomingEvents} events</span>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full group-hover:bg-gradient-hero group-hover:text-white group-hover:border-0 transition-all"
        >
          Follow Community
        </Button>
      </CardContent>
    </Card>
  );
};

export default CommunityCard;
