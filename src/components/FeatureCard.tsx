import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => {
  return (
    <Card className="border-2 hover:border-primary/50 transition-all duration-500 hover:shadow-glow group">
      <CardContent className="p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-card flex items-center justify-center group-hover:bg-gradient-hero transition-all duration-500 group-hover:scale-110 shadow-lg">
          <Icon className="h-8 w-8 text-primary group-hover:text-white transition-colors" />
        </div>
        <h3 className="font-bold text-xl group-hover:text-gradient transition-all">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;
