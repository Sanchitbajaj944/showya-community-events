import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateCommunityDialogProps {
  children: React.ReactNode;
  onSuccess?: () => void;
}

export const CreateCommunityDialog = ({ children, onSuccess }: CreateCommunityDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    categories: [] as string[],
    description: "",
  });
  const { toast } = useToast();

  const categories = [
    "Music",
    "Poetry",
    "Comedy",
    "Theatre",
    "Art",
    "Writing",
    "Dance",
    "Photography",
    "Film",
    "Other"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.categories.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and select at least one category",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to create a community");
      }

      const { data, error } = await supabase.functions.invoke('create-community', {
        body: {
          name: formData.name,
          categories: formData.categories,
          description: formData.description,
        },
      });

      if (error) throw error;

      toast({
        title: "Community Created!",
        description: data.message || "Your community has been created successfully. KYC process initiated.",
      });

      setFormData({ name: "", categories: [], description: "" });
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Create community error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create community. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Your Community</DialogTitle>
          <DialogDescription>
            Start your own creative community. Each user can create one community.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Community Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Mumbai Poetry Club"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>Categories * (Select at least one)</Label>
            <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg bg-muted/20">
              {categories.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-accent/10 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={formData.categories.includes(cat)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          categories: [...formData.categories, cat],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          categories: formData.categories.filter((c) => c !== cat),
                        });
                      }
                    }}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm">{cat}</span>
                </label>
              ))}
            </div>
            {formData.categories.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Selected: {formData.categories.join(", ")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell people what your community is about..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Community"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
