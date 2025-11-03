import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, AlertCircle, Loader2, MoreVertical, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/ReportDialog";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface CommunityChatProps {
  community: any;
  userRole: 'owner' | 'member' | 'public';
}

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profile?: {
    name: string;
    profile_picture_url?: string;
  };
  optimistic?: boolean;
}

interface TypingUser {
  user_id: string;
  name: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const TYPING_TIMEOUT = 3000;

export const CommunityChat = ({ community, userRole }: CommunityChatProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTargetUserId, setReportTargetUserId] = useState<string | null>(null);
  const [reportTargetName, setReportTargetName] = useState<string | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef<number>(0);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial messages
  useEffect(() => {
    if (!community?.id || userRole === 'public') return;

    const loadMessages = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('community_messages')
          .select('id, content, user_id, created_at')
          .eq('community_id', community.id)
          .order('created_at', { ascending: true })
          .limit(100);

        if (fetchError) throw fetchError;

        // Fetch profiles separately
        const userIds = [...new Set(data?.map(m => m.user_id) || [])];
        const { data: profilesData } = await supabase
          .from('profiles_public')
          .select('user_id, name, profile_picture_url')
          .in('user_id', userIds);

        // Create a map of user profiles
        const profilesMap = new Map(
          (profilesData || []).map(p => [p.user_id, p])
        );

        const formattedMessages = (data || []).map(msg => ({
          id: msg.id,
          content: msg.content,
          user_id: msg.user_id,
          created_at: msg.created_at,
          profile: profilesMap.get(msg.user_id) || { name: 'Unknown User' }
        }));

        setMessages(formattedMessages);
      } catch (err: any) {
        console.error('Error loading messages:', err);
        setError('Failed to load messages. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [community?.id, userRole]);

  // Set up realtime subscription
  useEffect(() => {
    if (!community?.id || !user || userRole === 'public') return;

    const channel = supabase
      .channel(`community-chat:${community.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
          filter: `community_id=eq.${community.id}`
        },
        async (payload) => {
          // Fetch user profile for the new message
          const { data: profile } = await supabase
            .from('profiles_public')
            .select('name, profile_picture_url')
            .eq('user_id', payload.new.user_id)
            .single();

          const newMessage: Message = {
            id: payload.new.id,
            content: payload.new.content,
            user_id: payload.new.user_id,
            created_at: payload.new.created_at,
            profile: profile || { name: 'Unknown User' }
          };

          setMessages(prev => {
            // Remove optimistic message if exists
            const filtered = prev.filter(m => !m.optimistic || m.user_id !== newMessage.user_id);
            return [...filtered, newMessage];
          });
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString()
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [community?.id, user, userRole]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping && channelRef.current) {
      setIsTyping(true);
      channelRef.current.track({
        user_id: user?.id,
        typing: true
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (channelRef.current) {
        channelRef.current.track({
          user_id: user?.id,
          typing: false
        });
      }
    }, TYPING_TIMEOUT);
  };

  const handleSend = async () => {
    if (!message.trim() || !user || sending) return;

    // Client-side validation
    if (message.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    // Rate limiting check (10 messages per minute)
    const now = Date.now();
    if (now - lastMessageTimeRef.current < 6000) {
      toast.error('Please wait a moment before sending another message.');
      return;
    }

    const messageContent = message.trim();
    setMessage("");
    setSending(true);
    setError(null);

    // Optimistic UI update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      user_id: user.id,
      created_at: new Date().toISOString(),
      optimistic: true,
      profile: {
        name: user.email || 'You',
        profile_picture_url: undefined
      }
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { error: insertError } = await supabase
        .from('community_messages')
        .insert({
          community_id: community.id,
          user_id: user.id,
          content: messageContent,
          message_type: 'text'
        });

      if (insertError) {
        // Handle rate limiting error
        if (insertError.message.includes('Rate limit exceeded')) {
          toast.error('You\'re sending messages too quickly. Please slow down.');
        } else {
          throw insertError;
        }
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => !m.optimistic));
      } else {
        lastMessageTimeRef.current = now;
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message. Please try again.');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => !m.optimistic));
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (userRole === 'public') {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Join this community to access the chat.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col border-0 shadow-none">
      <CardHeader className="border-b bg-muted/30 py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Community Chat</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {onlineCount} {onlineCount === 1 ? 'member' : 'members'} online
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
        {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No messages yet — say hi 👋</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.user_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''} ${
                    msg.optimistic ? 'opacity-50' : ''
                  } group`}
                >
                  {!isOwnMessage && (
                    <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
                      <AvatarImage src={msg.profile?.profile_picture_url} />
                      <AvatarFallback className="text-xs">
                        {msg.profile?.name?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`flex flex-col max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-baseline gap-2 mb-0.5 px-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-medium text-foreground">
                        {isOwnMessage ? 'You' : msg.profile?.name || 'Unknown'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                    <div className="flex items-start gap-1">
                      <div
                        className={`px-3 py-2 rounded-2xl ${
                          isOwnMessage
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted text-foreground rounded-tl-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                      {!isOwnMessage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setReportTargetUserId(msg.user_id);
                                setReportTargetName(msg.profile?.name || 'User');
                                setReportMessageId(msg.id);
                                setReportDialogOpen(true);
                              }}
                            >
                              <Flag className="h-4 w-4 mr-2" />
                              Report
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="p-3 border-t bg-muted/30">
        <div className="flex gap-2 items-end">
          <Input
            placeholder="Type a message..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            disabled={sending}
            maxLength={MAX_MESSAGE_LENGTH}
            className="flex-1 bg-background"
          />
          <Button 
            onClick={handleSend} 
            disabled={!message.trim() || sending}
            size="icon"
            className="h-10 w-10 flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {message.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </p>
        )}
      </div>

      {reportTargetUserId && (
        <ReportDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          targetUserId={reportTargetUserId}
          targetType="user"
          contextType="chat"
          contextId={reportMessageId || undefined}
          targetName={reportTargetName || undefined}
        />
      )}
    </Card>
  );
};
