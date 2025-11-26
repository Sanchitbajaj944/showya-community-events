import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COMMUNITY_CATEGORIES = [
  "Music", "Comedy", "Dance", "Theatre", "Art", 
  "Sports", "Gaming", "Technology", "Education", "Other"
];

export default function CreateCommunity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    categories: [] as string[],
  });

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Please sign in to create a community");
      navigate("/auth/signin");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Please enter a community name");
      return;
    }

    if (formData.categories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("create-community", {
        body: {
          name: formData.name.trim(),
          description: formData.description.trim(),
          categories: formData.categories,
        },
      });

      if (error) throw error;

      toast.success("Community created successfully!");
      navigate(`/community/${data.communityId}`);
    } catch (error: any) {
      console.error("Error creating community:", error);
      toast.error(error.message || "Failed to create community");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create Your Community</CardTitle>
            <CardDescription>
              Build a space for people who share your passion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Community Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Community Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter community name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  maxLength={100}
                  required
                />
              </div>

              {/* Categories */}
              <div className="space-y-3">
                <Label>Categories * (Select at least one)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {COMMUNITY_CATEGORIES.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={category}
                        checked={formData.categories.includes(category)}
                        onCheckedChange={() => handleCategoryToggle(category)}
                      />
                      <Label
                        htmlFor={category}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell people what your community is about..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={5}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.description.length}/1000 characters
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Community"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
