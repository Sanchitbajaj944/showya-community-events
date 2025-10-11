-- Add foreign key constraint from community_members to profiles
ALTER TABLE public.community_members
ADD CONSTRAINT community_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;