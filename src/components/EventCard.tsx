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
    <Card className="min-w-[300px] md:min-w-[340px] overflow-hidden hover:shadow-glow transition-all duration-500 cursor-pointer group border-2 hover:border-primary/50">
      <div className="relative h-56 overflow-hidden bg-gradient-card">
        {image ? (
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
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
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-xl line-clamp-2 group-hover:text-primary transition-colors mb-2">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground font-semibold">{community}</p>
        </div>
        <div className="space-y-2.5 text-sm">
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
      </CardContent>
    </Card>
  );
};

export default EventCard;
