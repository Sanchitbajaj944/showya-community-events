import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, LayoutGrid, Film, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import { SectionId, useHomepageSectionOrder } from "@/hooks/useHomepageSectionOrder";

const SECTION_CONFIG: Record<SectionId, { label: string; icon: React.ElementType; description: string }> = {
  showclips: {
    label: "ShowClips",
    icon: Film,
    description: "Video reels from community events",
  },
  events: {
    label: "Upcoming Events",
    icon: Calendar,
    description: "Featured upcoming events",
  },
  communities: {
    label: "Communities",
    icon: Users,
    description: "Featured communities",
  },
};

export function HomepageSectionOrder() {
  const { sectionOrder, loading, updateSectionOrder } = useHomepageSectionOrder();
  const [localOrder, setLocalOrder] = useState<SectionId[]>([]);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  // Sync local state only once when data first loads
  useEffect(() => {
    if (!loading && !initializedRef.current && sectionOrder.length > 0) {
      setLocalOrder(sectionOrder);
      initializedRef.current = true;
    }
  }, [loading, sectionOrder]);

  const moveSection = (index: number, direction: "up" | "down") => {
    const newOrder = [...localOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setLocalOrder(newOrder);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await updateSectionOrder(localOrder);
    setSaving(false);

    if (success) {
      toast.success("Homepage section order updated");
    } else {
      toast.error("Failed to update section order");
    }
  };

  const hasChanges = localOrder.join(",") !== sectionOrder.join(",");

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5" />
          Homepage Section Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Drag sections to reorder how they appear on the homepage. This helps with A/B testing different layouts.
        </p>

        <div className="space-y-2">
          {localOrder.map((sectionId, index) => {
            const config = SECTION_CONFIG[sectionId];
            const Icon = config.icon;

            return (
              <div
                key={sectionId}
                className="flex items-center gap-3 p-4 border rounded-lg bg-background"
              >
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === 0}
                    onClick={() => moveSection(index, "up")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === localOrder.length - 1}
                    onClick={() => moveSection(index, "down")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>

                <div className="flex-1">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>

                <div className="text-sm text-muted-foreground font-medium">
                  Position {index + 1}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {hasChanges ? "You have unsaved changes" : "No changes to save"}
          </p>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? "Saving..." : "Save Order"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
