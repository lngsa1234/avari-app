-- ============================================================================
-- CONNECTION & GROUP RECOMMENDATIONS FIX MIGRATION
-- Fixes foreign key references to point to profiles instead of auth.users
-- Run this if you already created the recommendation tables
-- ============================================================================

-- ============================================================================
-- FIX connection_recommendations TABLE
-- ============================================================================

-- Drop existing foreign key constraints
ALTER TABLE connection_recommendations
  DROP CONSTRAINT IF EXISTS connection_recommendations_user_id_fkey;

ALTER TABLE connection_recommendations
  DROP CONSTRAINT IF EXISTS connection_recommendations_recommended_user_id_fkey;

-- Add new foreign key constraints referencing profiles table
ALTER TABLE connection_recommendations
  ADD CONSTRAINT connection_recommendations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE connection_recommendations
  ADD CONSTRAINT connection_recommendations_recommended_user_id_fkey
  FOREIGN KEY (recommended_user_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- ============================================================================
-- FIX group_recommendations TABLE
-- ============================================================================

-- Drop existing foreign key constraint
ALTER TABLE group_recommendations
  DROP CONSTRAINT IF EXISTS group_recommendations_user_id_fkey;

-- Add new foreign key constraint referencing profiles table
ALTER TABLE group_recommendations
  ADD CONSTRAINT group_recommendations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- ============================================================================
-- VERIFY CONSTRAINTS
-- ============================================================================

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
WHERE tc.table_name IN ('connection_recommendations', 'group_recommendations')
  AND tc.constraint_type = 'FOREIGN KEY';
