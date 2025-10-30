-- Create storage bucket for event posters if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Event posters are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event posters" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own event posters" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own event posters" ON storage.objects;

-- Allow public access to view event posters
CREATE POLICY "Event posters are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-posters');

-- Allow authenticated users to upload event posters
CREATE POLICY "Authenticated users can upload event posters"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-posters' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to update their own event posters
CREATE POLICY "Users can update their own event posters"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-posters' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'event-posters' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own event posters
CREATE POLICY "Users can delete their own event posters"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-posters' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);