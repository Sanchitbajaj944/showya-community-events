import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/UserAvatar";
import { SkillsSelect } from "@/components/SkillsSelect";
import Header from "@/components/Header";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

const editProfileSchema = z.object({
  display_name: z.string().min(2, "Name must be at least 2 characters").max(50),
  bio: z.string().max(100, "Bio must be 100 characters or less").optional(),
  city: z.string().max(100).optional(),
  skills: z.array(z.string()),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

export default function EditProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      skills: [],
    },
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth/signin");
      return;
    }
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setValue("display_name", data.display_name || data.name || "");
        setValue("bio", data.bio || "");
        setValue("city", data.city || "");
        setValue("skills", data.skills || []);
        setProfilePicture(data.profile_picture_url);
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image (JPEG, PNG, or WebP)");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    try {
      setUploadingImage(true);

      // Delete old profile picture if exists
      if (profilePicture) {
        const oldPath = profilePicture.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from("profile-pictures")
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new image
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(filePath);

      // Update profile in database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_picture_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setProfilePicture(publicUrl);
      toast.success("Profile picture updated!");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload profile picture");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onSubmit = async (data: EditProfileFormData) => {
    if (!user) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: data.display_name,
          bio: data.bio || null,
          city: data.city || null,
          skills: data.skills,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      navigate("/profile");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <Header />
      
      {/* Mobile-only sub-header */}
      <div className="md:hidden bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Edit Profile</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Profile Picture */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <UserAvatar
                src={profilePicture}
                name={user?.user_metadata?.name}
                size="xl"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploadingImage}
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full shadow-lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {uploadingImage ? "Uploading..." : "Tap to change profile picture (max 5MB)"}
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name *</Label>
            <Input
              id="display_name"
              placeholder="How should we call you?"
              {...register("display_name")}
              disabled={loading}
            />
            {errors.display_name && (
              <p className="text-sm text-destructive">
                {errors.display_name.message}
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio (max 100 characters)</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              maxLength={100}
              rows={3}
              {...register("bio")}
              disabled={loading}
            />
            {errors.bio && (
              <p className="text-sm text-destructive">{errors.bio.message}</p>
            )}
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city">City / Location</Label>
            <Input
              id="city"
              placeholder="e.g., Mumbai, Bangalore"
              {...register("city")}
              disabled={loading}
            />
            {errors.city && (
              <p className="text-sm text-destructive">{errors.city.message}</p>
            )}
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <Label>Skills *</Label>
            <Controller
              name="skills"
              control={control}
              render={({ field }) => (
                <SkillsSelect
                  value={field.value}
                  onChange={field.onChange}
                  disabled={loading}
                />
              )}
            />
            {errors.skills && (
              <p className="text-sm text-destructive">
                {errors.skills.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}