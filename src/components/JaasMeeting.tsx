import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Video, VideoOff, Mic, MicOff, Phone, Maximize2, Minimize2, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JaasMeetingProps {
  eventId: string;
  eventTitle: string;
  onClose?: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export function JaasMeeting({ eventId, eventTitle, onClose }: JaasMeetingProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  const loadJitsiScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://8x8.vc/vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/external_api.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Jitsi script'));
      document.head.appendChild(script);
    });
  }, []);

  const initMeeting = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get JaaS token from edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to join the meeting');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase.functions.invoke('generate-jaas-token', {
        body: { eventId }
      });

      if (fetchError || !data) {
        console.error('Token fetch error:', fetchError);
        setError(fetchError?.message || 'Failed to generate meeting token');
        setLoading(false);
        return;
      }

      const { token, roomName, appId, isModerator } = data;

      // Load Jitsi script
      await loadJitsiScript();

      if (!containerRef.current || !window.JitsiMeetExternalAPI) {
        setError('Failed to initialize meeting');
        setLoading(false);
        return;
      }

      // Clean up any existing API instance
      if (apiRef.current) {
        apiRef.current.dispose();
      }

      // Initialize Jitsi Meet
      const api = new window.JitsiMeetExternalAPI('8x8.vc', {
        roomName: `${appId}/${roomName}`,
        jwt: token,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          subject: eventTitle,
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableNoisyMicDetection: true,
          enableNoiseFiltering: true,
          disableDeepLinking: true,
          hideConferenceSubject: false,
          hideConferenceTimer: false,
          hiddenPremeetingButtons: ['microphone', 'camera', 'select-background', 'invite', 'settings'],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true,
          TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'desktop',
            'fullscreen',
            'chat',
            'raisehand',
            'participants-pane',
            'tileview',
            'settings',
            'hangup',
          ],
        },
      });

      apiRef.current = api;

      // Event listeners
      api.addListener('videoConferenceJoined', () => {
        setIsJoined(true);
        setLoading(false);
      });

      api.addListener('participantJoined', () => {
        setParticipantCount(prev => prev + 1);
      });

      api.addListener('participantLeft', () => {
        setParticipantCount(prev => Math.max(0, prev - 1));
      });

      api.addListener('audioMuteStatusChanged', ({ muted }: { muted: boolean }) => {
        setIsMuted(muted);
      });

      api.addListener('videoMuteStatusChanged', ({ muted }: { muted: boolean }) => {
        setIsVideoOff(muted);
      });

      api.addListener('readyToClose', () => {
        if (onClose) {
          onClose();
        }
      });

      api.addListener('videoConferenceLeft', () => {
        setIsJoined(false);
        if (onClose) {
          onClose();
        }
      });

    } catch (err) {
      console.error('Meeting init error:', err);
      setError(err instanceof Error ? err.message : 'Failed to join meeting');
      setLoading(false);
    }
  }, [eventId, eventTitle, loadJitsiScript, onClose]);

  useEffect(() => {
    initMeeting();

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [initMeeting]);

  const toggleMute = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleAudio');
    }
  };

  const toggleVideo = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleVideo');
    }
  };

  const hangUp = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('hangup');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 text-center">
          <VideoOff className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-destructive font-medium mb-2">Unable to join meeting</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={initMeeting}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`relative bg-background rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : 'aspect-video'}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Joining meeting...</p>
          </div>
        </div>
      )}
      
      {/* Meeting container */}
      <div 
        ref={containerRef} 
        className="w-full h-full min-h-[400px]"
        style={{ height: isFullscreen ? '100vh' : '100%' }}
      />

      {/* Custom controls overlay */}
      {isJoined && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border">
          <Button
            variant={isMuted ? "destructive" : "ghost"}
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={toggleMute}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isVideoOff ? "destructive" : "ghost"}
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={toggleVideo}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          <div className="flex items-center gap-1 px-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{participantCount + 1}</span>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={hangUp}
          >
            <Phone className="h-5 w-5 rotate-[135deg]" />
          </Button>
        </div>
      )}
    </div>
  );
}
