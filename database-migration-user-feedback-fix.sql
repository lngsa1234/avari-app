-- ============================================================================
-- USER FEEDBACK FIX MIGRATION
-- Fixes foreign key references to point to profiles instead of auth.users
-- Run this if you already created the user_feedback table
-- ============================================================================

-- Drop existing foreign key constraints
ALTER TABLE user_feedback
  DROP CONSTRAINT IF EXISTS user_feedback_user_id_fkey;

ALTER TABLE user_feedback
  DROP CONSTRAINT IF EXISTS user_feedback_reviewed_by_fkey;

-- Add new foreign key constraints referencing profiles table
ALTER TABLE user_feedback
  ADD CONSTRAINT user_feedback_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE user_feedback
  ADD CONSTRAINT user_feedback_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Verify the constraints were created
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'user_feedback'
  AND tc.constraint_type = 'FOREIGN KEY';
