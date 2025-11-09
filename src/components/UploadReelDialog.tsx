import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

interface UploadReelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  communityId: string;
  communityName: string;
  onSuccess?: () => void;
}

interface Performer {
  user_id: string;
  name: string;
  display_name: string | null;
}

export function UploadReelDialog({
  open,
  onOpenChange,
  eventId,
  communityId,
  communityName,
  onSuccess,
}: UploadReelDialogProps) {
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [selectedPerformer, setSelectedPerformer] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [featureText, setFeatureText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPerformers();
    }
  }, [open, eventId]);

  const fetchPerformers = async () => {
    try {
      const { data: participants, error } = await supabase
        .from("event_participants")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("role", "performer");

      if (error) throw error;

      if (participants && participants.length > 0) {
        const userIds = participants.map(p => p.user_id);
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, name, display_name")
          .in("user_id", userIds);

        if (profileError) throw profileError;

        const performersData = profiles?.map(profile => ({
          user_id: profile.user_id,
          name: profile.name,
          display_name: profile.display_name,
        })) || [];

        setPerformers(performersData);
      }
    } catch (error) {
      console.error("Error fetching performers:", error);
      toast.error("Failed to load performers");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPerformer) {
      toast.error("Please select a performer");
      return;
    }

    if (!videoFile) {
      toast.error("Please upload a video file");
      return;
    }

    // Validate video duration (max 120 seconds)
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(videoFile);
    
    video.onloadedmetadata = async () => {
      if (video.duration > 120) {
        toast.error("Video must be 120 seconds or less");
        return;
      }

      setLoading(true);

      try {
        // Upload video to storage
        const fileExt = videoFile.name.split(".").pop();
        const fileName = `${eventId}_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("reels")
          .upload(fileName, videoFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("reels")
          .getPublicUrl(fileName);

        // Create spotlight entry
        const { error: insertError } = await supabase
          .from("spotlights")
          .insert({
            event_id: eventId,
            user_id: selectedPerformer,
            community_name: communityName,
            feature_text: featureText || `Spotlight Performer`,
            video_url: urlData.publicUrl,
            caption: caption || null,
            view_count: 0,
            like_count: 0,
          });

        if (insertError) throw insertError;

        toast.success("ShowClip uploaded successfully!");
        onOpenChange(false);
        resetForm();
        if (onSuccess) onSuccess();
      } catch (error: any) {
        console.error("Error uploading reel:", error);
        toast.error(error.message || "Failed to upload ShowClip");
      } finally {
        setLoading(false);
      }
    };
  };

  const resetForm = () => {
    setSelectedPerformer("");
    setVideoFile(null);
    setCaption("");
    setFeatureText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Spotlight ShowClip</DialogTitle>
          <DialogDescription>
            Feature the best performance from your event. Max 120 seconds.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Performer Selection */}
          <div className="space-y-2">
            <Label htmlFor="performer">Spotlight Performer *</Label>
            <Select value={selectedPerformer} onValueChange={setSelectedPerformer}>
              <SelectTrigger id="performer">
                <SelectValue placeholder="Select a performer" />
              </SelectTrigger>
              <SelectContent>
                {performers.map((performer) => (
                  <SelectItem key={performer.user_id} value={performer.user_id}>
                    {performer.display_name || performer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Video Upload */}
          <div className="space-y-2">
            <Label htmlFor="video">Video File *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="video"
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            {videoFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {videoFile.name}
              </p>
            )}
          </div>

          {/* Feature Text */}
          <div className="space-y-2">
            <Label htmlFor="feature">Feature Text</Label>
            <Input
              id="feature"
              placeholder="e.g., Best Solo Performance"
              value={featureText}
              onChange={(e) => setFeatureText(e.target.value)}
            />
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <Label htmlFor="caption">Caption (Optional)</Label>
            <Textarea
              id="caption"
              placeholder="Add a description..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload ShowClip"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
