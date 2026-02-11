import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserBooking {
  event_id: string;
  role: string;
  ticket_code: string | null;
}

/**
 * Batch-fetches the current user's bookings for a list of event IDs.
 * Returns a map of eventId → UserBooking (or null if not booked).
 * For non-logged-in users, returns an empty map (no queries fired).
 */
export function useUserBookings(eventIds: string[]) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Record<string, UserBooking>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || eventIds.length === 0) {
      setBookings({});
      return;
    }

    const fetchBookings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("event_participants")
          .select("event_id, role, ticket_code")
          .eq("user_id", user.id)
          .in("event_id", eventIds);

        if (error) {
          console.error("Error fetching user bookings:", error);
          setBookings({});
          return;
        }

        const map: Record<string, UserBooking> = {};
        (data || []).forEach((row) => {
          map[row.event_id] = {
            event_id: row.event_id,
            role: row.role,
            ticket_code: row.ticket_code,
          };
        });
        setBookings(map);
      } catch (err) {
        console.error("Error fetching user bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user?.id, JSON.stringify(eventIds)]);

  return { bookings, loading };
}
