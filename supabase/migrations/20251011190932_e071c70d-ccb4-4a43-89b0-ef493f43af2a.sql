-- Change category column to support multiple categories
ALTER TABLE public.communities 
DROP COLUMN category;

ALTER TABLE public.communities 
ADD COLUMN categories text[] NOT NULL DEFAULT '{}';
