-- Add image_url column to connection_groups table for circle cover photos
ALTER TABLE connection_groups ADD COLUMN IF NOT EXISTS image_url TEXT;
