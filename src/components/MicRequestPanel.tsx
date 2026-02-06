import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface MicRequest {
  user_id: string;
  mic_permission: string;
  userName: string;
}

interface MicRequestPanelProps {
  eventId: string;
}

export function MicRequestPanel({ eventId }: MicRequestPanelProps) {
  const [requests, setRequests] = useState<MicRequest[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Fetch initial pending requests
  useEffect(() => {
    const fetchRequests = async () => {
      const { data: participants } = await supabase
        .from('event_participants')
        .select('user_id, mic_permission')
        .eq('event_id', eventId)
        .eq('role', 'audience')
        .in('mic_permission', ['requested', 'granted']);

      if (participants) {
        // Fetch profile names for these users
        const userIds = participants.map(p => p.user_id);
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, name, display_name')
          .in('user_id', userIds);

        const profileMap = new Map(
          (profiles || []).map(p => [p.user_id, p.display_name || p.name || 'Unknown'])
        );

        setRequests(
          participants.map(p => ({
            user_id: p.user_id,
            mic_permission: p.mic_permission ?? 'none',
            userName: profileMap.get(p.user_id) || 'Unknown User',
          }))
        );
      }
    };

    fetchRequests();
  }, [eventId]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel(`mic-requests-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'event_participants',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const updated = payload.new as any;
          if (updated.mic_permission === 'requested' || updated.mic_permission === 'granted') {
            // Fetch user name
            const { data: profile } = await supabase
              .from('profiles_public')
              .select('name, display_name')
              .eq('user_id', updated.user_id)
              .single();

            const userName = profile?.display_name || profile?.name || 'Unknown User';

            setRequests(prev => {
              const existing = prev.find(r => r.user_id === updated.user_id);
              if (existing) {
                return prev.map(r =>
                  r.user_id === updated.user_id
                    ? { ...r, mic_permission: updated.mic_permission }
                    : r
                );
              }
              return [...prev, { user_id: updated.user_id, mic_permission: updated.mic_permission, userName }];
            });

            if (updated.mic_permission === 'requested') {
              toast.info(`${userName} is requesting mic access`);
            }
          } else if (updated.mic_permission === 'revoked' || updated.mic_permission === 'none') {
            setRequests(prev => prev.filter(r => r.user_id !== updated.user_id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const handleResolve = async (targetUserId: string, action: 'grant' | 'revoke') => {
    setLoading(prev => ({ ...prev, [targetUserId]: true }));

    try {
      const { error } = await supabase.functions.invoke('resolve-mic', {
        body: { eventId, targetUserId, action },
      });

      if (error) throw error;

      if (action === 'revoke') {
        setRequests(prev => prev.filter(r => r.user_id !== targetUserId));
      }

      toast.success(action === 'grant' ? 'Mic access granted' : 'Mic access revoked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update mic permission');
    } finally {
      setLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const pendingRequests = requests.filter(r => r.mic_permission === 'requested');
  const grantedUsers = requests.filter(r => r.mic_permission === 'granted');

  if (requests.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mic className="h-4 w-4" />
          Mic Requests
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {pendingRequests.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendingRequests.map(req => (
          <div
            key={req.user_id}
            className="flex items-center justify-between p-2 bg-muted rounded-lg"
          >
            <span className="text-sm font-medium truncate flex-1">{req.userName}</span>
            <div className="flex gap-1 ml-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                onClick={() => handleResolve(req.user_id, 'grant')}
                disabled={loading[req.user_id]}
              >
                {loading[req.user_id] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleResolve(req.user_id, 'revoke')}
                disabled={loading[req.user_id]}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {grantedUsers.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-muted-foreground mb-1">Active speakers</p>
            {grantedUsers.map(req => (
              <div
                key={req.user_id}
                className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Mic className="h-3 w-3 text-green-600" />
                  <span className="text-sm truncate">{req.userName}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive"
                  onClick={() => handleResolve(req.user_id, 'revoke')}
                  disabled={loading[req.user_id]}
                >
                  <MicOff className="h-3 w-3 mr-1" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
