-- Create community_members table
CREATE TABLE public.community_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- Create community_messages table
CREATE TABLE public.community_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'event')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create community_invites table
CREATE TABLE public.community_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  uses_count INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_members
CREATE POLICY "Members are viewable by everyone"
  ON public.community_members FOR SELECT
  USING (true);

CREATE POLICY "Users can join communities"
  ON public.community_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Community owners can manage members"
  ON public.community_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE id = community_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave communities"
  ON public.community_members FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for community_messages
CREATE POLICY "Messages viewable by community members"
  ON public.community_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_id = community_messages.community_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Community members can send messages"
  ON public.community_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_id = community_messages.community_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.community_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Community owners can delete any message"
  ON public.community_messages FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE id = community_messages.community_id AND owner_id = auth.uid()
    )
  );

-- RLS Policies for community_invites
CREATE POLICY "Invites viewable by community owners"
  ON public.community_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE id = community_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Community owners can create invites"
  ON public.community_invites FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE id = community_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Community owners can delete invites"
  ON public.community_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE id = community_id AND owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_community_members_community ON public.community_members(community_id);
CREATE INDEX idx_community_members_user ON public.community_members(user_id);
CREATE INDEX idx_community_messages_community ON public.community_messages(community_id);
CREATE INDEX idx_community_messages_created ON public.community_messages(created_at DESC);
CREATE INDEX idx_community_invites_code ON public.community_invites(invite_code);

-- Add trigger for updating messages updated_at
CREATE TRIGGER update_community_messages_updated_at
  BEFORE UPDATE ON public.community_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically add owner as member
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (community_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to add owner as member when community is created
CREATE TRIGGER on_community_created
  AFTER INSERT ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_as_member();