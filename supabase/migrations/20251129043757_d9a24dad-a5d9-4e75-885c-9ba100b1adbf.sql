-- Add unique constraint on community names
ALTER TABLE public.communities ADD CONSTRAINT communities_name_unique UNIQUE (name);