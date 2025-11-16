import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Calendar, Users, User, Film, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Calendar, label: "Events", path: "/events" },
  { icon: Film, label: "ShowClips", path: "/reels" },
  { icon: Users, label: "Communities", path: "/communities" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();

      // Subscribe to real-time notification changes
      const channel = supabase
        .channel("notification-count")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;

    try {
      const { data } = await supabase.rpc("get_unread_notification_count");
      setUnreadCount(data || 0);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
        
        {/* Notifications Icon */}
        {user && (
          <Link
            to="/notifications"
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors relative",
              location.pathname === "/notifications"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute top-2 right-1/2 translate-x-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
            <span className="text-xs font-medium">Alerts</span>
          </Link>
        )}
      </div>
    </nav>
  );
}