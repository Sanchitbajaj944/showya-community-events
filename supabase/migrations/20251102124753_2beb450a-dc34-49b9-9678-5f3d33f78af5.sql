-- Create community-banners storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-banners', 'community-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for community banners
CREATE POLICY "Community banners are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-banners');

CREATE POLICY "Community owners can upload banners"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'community-banners' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.communities WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Community owners can update banners"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'community-banners'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.communities WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Community owners can delete banners"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'community-banners'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.communities WHERE owner_id = auth.uid()
  )
);