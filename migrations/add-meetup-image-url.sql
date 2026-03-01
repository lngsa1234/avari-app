-- Add image_url column to meetups table for event photo uploads
ALTER TABLE meetups ADD COLUMN IF NOT EXISTS image_url TEXT;
