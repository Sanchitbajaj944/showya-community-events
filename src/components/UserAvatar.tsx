import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-lg",
  xl: "h-32 w-32 text-3xl",
};

export function UserAvatar({ src, name, size = "md", className }: UserAvatarProps) {
  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getColorFromName = (name?: string | null) => {
    if (!name) return "bg-muted";
    const colors = [
      "bg-primary/80",
      "bg-secondary/80",
      "bg-accent/80",
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-orange-500",
    ];
    const charCode = name.charCodeAt(0);
    return colors[charCode % colors.length];
  };

  return (
    <Avatar className={`${sizeClasses[size]} ${className || ""}`}>
      {src && <AvatarImage src={src} alt={name || "User"} />}
      <AvatarFallback className={`${getColorFromName(name)} text-white font-semibold`}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}