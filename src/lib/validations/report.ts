import { z } from "zod";

export const reportSchema = z.object({
  reason: z.string().min(1, "Please select a reason"),
  incident_location: z.string().min(1, "Please specify where this incident occurred"),
  message: z.string()
    .min(50, "Description must be at least 50 characters")
    .max(500, "Description must be less than 500 characters")
    .trim(),
});

export type ReportFormData = z.infer<typeof reportSchema>;

export const USER_INCIDENT_LOCATIONS = [
  "Chat message",
  "During event/meeting",
  "Profile picture",
  "Profile information",
] as const;

export const COMMUNITY_OWNER_INCIDENT_LOCATIONS = [
  "Chat message",
  "During event/meeting",
  "Profile picture",
  "Community description",
  "Community banner",
  "Event page/details",
] as const;
