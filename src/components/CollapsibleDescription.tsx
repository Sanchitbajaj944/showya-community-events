import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";

interface CollapsibleDescriptionProps {
  description: string;
  className?: string;
}

export const CollapsibleDescription = ({ description, className = "" }: CollapsibleDescriptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={className}>
      <p 
        className={`text-muted-foreground whitespace-pre-wrap break-words ${
          !isExpanded ? "line-clamp-2" : ""
        }`}
      >
        {description}
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-2 h-8 px-2 text-xs"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-3 w-3 mr-1" />
            Show less
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3 mr-1" />
            Show more
          </>
        )}
      </Button>
    </div>
  );
};
