import { Calendar, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <Card className="min-w-[280px] md:min-w-[320px] overflow-hidden hover:shadow-hover transition-all duration-300 cursor-pointer group">
      <div className="relative h-48 overflow-hidden bg-gradient-card">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-gradient-card" />
        )}
        <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
          {category}
        </Badge>
      </div>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground font-medium">{community}</p>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>{date}</span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">{location}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>{attendees} attending</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventCard;
