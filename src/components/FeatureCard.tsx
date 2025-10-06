import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => {
  return (
    <Card className="border-2 hover:border-primary transition-all duration-300 hover:shadow-card">
      <CardContent className="p-6 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-full bg-gradient-card flex items-center justify-center">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;
