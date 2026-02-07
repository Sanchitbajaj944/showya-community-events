import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlueTickProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function BlueTick({ className, size = "md" }: BlueTickProps) {
  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <BadgeCheck
      className={cn(
        "text-blue-500 fill-blue-500/20 shrink-0",
        sizeClasses[size],
        className
      )}
      aria-label="Verified community"
    />
  );
}
