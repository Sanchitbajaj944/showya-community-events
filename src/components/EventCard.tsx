import { Calendar, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EventCardProps {
  title: string;
  community: string;
  date: string;
  location: string;
  attendees: number;
  category: string;
  image?: string;
}

const EventCard = ({
  title,
  community,
  date,
  location,
  attendees,
  category,
  image,
}: EventCardProps) => {
  return (
    <Card className="w-full max-w-[340px] h-[440px] overflow-hidden cursor-pointer border-2 flex flex-col">
      <div className="relative h-48 flex-shrink-0 overflow-hidden bg-gradient-card">
        {image ? (
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-card flex items-center justify-center">
            <div className="text-6xl opacity-20">🎭</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <Badge className="absolute top-4 left-4 bg-gradient-hero text-white border-0 shadow-lg font-semibold">
          {category}
        </Badge>
      </div>
      <CardContent className="p-5 space-y-3 flex-1 flex flex-col">
        <div className="flex-shrink-0">
          <h3 className="font-bold text-lg line-clamp-2 mb-1.5">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground font-semibold line-clamp-1">{community}</p>
        </div>
        <div className="space-y-2 text-sm flex-1">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{date}</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <MapPin className="h-4 w-4 text-secondary" />
            <span className="line-clamp-1">{location}</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Users className="h-4 w-4 text-accent" />
            <span className="font-semibold">{attendees} attending</span>
          </div>
        </div>
        <Button className="w-full mt-auto">
          View Event
        </Button>
      </CardContent>
    </Card>
  );
};

export default EventCard;
