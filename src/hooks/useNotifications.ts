import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationData {
  user_id: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  category?: string;
  related_id?: string;
  action_url?: string;
  send_email?: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);

  const createNotification = async (data: NotificationData) => {
    if (!data.user_id) {
      throw new Error("user_id is required");
    }

    setCreating(true);
    try {
      // Insert notification into database
      const { data: notification, error: insertError } = await supabase
        .from("notifications")
        .insert({
          user_id: data.user_id,
          title: data.title,
          message: data.message,
          type: data.type || "info",
          category: data.category || "general",
          related_id: data.related_id,
          action_url: data.action_url,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send email if requested
      if (data.send_email) {
        const { error: emailError } = await supabase.functions.invoke(
          "send-notification-email",
          {
            body: {
              user_id: data.user_id,
              title: data.title,
              message: data.message,
              action_url: data.action_url,
            },
          }
        );

        if (emailError) {
          console.error("Error sending notification email:", emailError);
          // Don't throw - notification was created successfully
        }
      }

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    } finally {
      setCreating(false);
    }
  };

  const createBulkNotifications = async (
    userIds: string[],
    notificationData: Omit<NotificationData, "user_id">
  ) => {
    const notifications = userIds.map((userId) => ({
      user_id: userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || "info",
      category: notificationData.category || "general",
      related_id: notificationData.related_id,
      action_url: notificationData.action_url,
    }));

    const { data, error } = await supabase
      .from("notifications")
      .insert(notifications)
      .select();

    if (error) throw error;

    // Send emails in bulk if requested
    if (notificationData.send_email) {
      const emailPromises = userIds.map((userId) =>
        supabase.functions.invoke("send-notification-email", {
          body: {
            user_id: userId,
            title: notificationData.title,
            message: notificationData.message,
            action_url: notificationData.action_url,
          },
        })
      );

      await Promise.allSettled(emailPromises);
    }

    return data;
  };

  return {
    createNotification,
    createBulkNotifications,
    creating,
  };
}
