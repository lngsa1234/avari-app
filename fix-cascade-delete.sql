-- Fix CASCADE delete for auth.users -> profiles relationship
-- This allows deleting users from auth.users to automatically delete their profile

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 2: Re-add the constraint with ON DELETE CASCADE
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Verify the constraint
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  confdeltype AS delete_action
FROM pg_constraint
WHERE conname = 'profiles_id_fkey';

-- Delete action codes:
-- 'a' = NO ACTION
-- 'r' = RESTRICT
-- 'c' = CASCADE (this is what we want)
-- 'n' = SET NULL
-- 'd' = SET DEFAULT
