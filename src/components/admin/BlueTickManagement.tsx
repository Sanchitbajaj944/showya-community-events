import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BadgeCheck, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { BlueTick } from "@/components/BlueTick";

interface CommunityBlueTick {
  id: string;
  name: string;
  is_blue_tick: boolean;
  blue_tick_granted_at: string | null;
  blue_tick_note: string | null;
  categories: string[];
  owner_id: string;
}

export function BlueTickManagement() {
  const [communities, setCommunities] = useState<CommunityBlueTick[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name, is_blue_tick, blue_tick_granted_at, blue_tick_note, categories, owner_id")
        .order("is_blue_tick", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw error;
      setCommunities((data as CommunityBlueTick[]) || []);
    } catch (error) {
      console.error("Error fetching communities:", error);
      toast.error("Failed to load communities");
    } finally {
      setLoading(false);
    }
  };

  const toggleBlueTick = async (communityId: string, currentValue: boolean) => {
    setUpdating(prev => new Set(prev).add(communityId));
    try {
      const newValue = !currentValue;
      const { error } = await supabase
        .from("communities")
        .update({
          is_blue_tick: newValue,
          blue_tick_granted_at: newValue ? new Date().toISOString() : null,
        })
        .eq("id", communityId);

      if (error) throw error;

      setCommunities(prev =>
        prev.map(c =>
          c.id === communityId
            ? {
                ...c,
                is_blue_tick: newValue,
                blue_tick_granted_at: newValue ? new Date().toISOString() : null,
              }
            : c
        )
      );

      toast.success(newValue ? "Blue Tick granted" : "Blue Tick revoked");
    } catch (error) {
      console.error("Error toggling blue tick:", error);
      toast.error("Failed to update blue tick status");
    } finally {
      setUpdating(prev => {
        const next = new Set(prev);
        next.delete(communityId);
        return next;
      });
    }
  };

  const saveNote = async (communityId: string) => {
    setUpdating(prev => new Set(prev).add(communityId));
    try {
      const { error } = await supabase
        .from("communities")
        .update({ blue_tick_note: noteValue || null })
        .eq("id", communityId);

      if (error) throw error;

      setCommunities(prev =>
        prev.map(c =>
          c.id === communityId ? { ...c, blue_tick_note: noteValue || null } : c
        )
      );

      setEditingNote(null);
      toast.success("Note saved");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    } finally {
      setUpdating(prev => {
        const next = new Set(prev);
        next.delete(communityId);
        return next;
      });
    }
  };

  const filtered = communities.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const verifiedCount = communities.filter(c => c.is_blue_tick).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-blue-500" />
          Blue Tick Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {verifiedCount} of {communities.length} communities verified
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search communities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Communities List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No communities found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(community => (
              <div
                key={community.id}
                className="p-4 border rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{community.name}</p>
                      {community.is_blue_tick && <BlueTick size="sm" />}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {community.categories?.slice(0, 3).map(cat => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                    {community.blue_tick_granted_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Verified since {new Date(community.blue_tick_granted_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {community.is_blue_tick ? "Verified" : "Not verified"}
                    </span>
                    <Switch
                      checked={community.is_blue_tick}
                      onCheckedChange={() => toggleBlueTick(community.id, community.is_blue_tick)}
                      disabled={updating.has(community.id)}
                    />
                  </div>
                </div>

                {/* Note */}
                {editingNote === community.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={noteValue}
                      onChange={e => setNoteValue(e.target.value)}
                      placeholder="Add a note (e.g., reason for verification)"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => saveNote(community.id)}
                        disabled={updating.has(community.id)}
                      >
                        Save
                      </button>
                      <button
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => setEditingNote(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                    onClick={() => {
                      setEditingNote(community.id);
                      setNoteValue(community.blue_tick_note || "");
                    }}
                  >
                    {community.blue_tick_note
                      ? `📝 ${community.blue_tick_note}`
                      : "Add note"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
