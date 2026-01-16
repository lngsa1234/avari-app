-- Comprehensive fix for all CASCADE deletes
-- This script fixes all foreign key constraints to auth.users to use ON DELETE CASCADE
-- Run this in your Supabase SQL Editor

-- ============================================================
-- PROFILES TABLE
-- ============================================================
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ============================================================
-- MEETUPS TABLE
-- ============================================================
-- Find and drop existing constraint for created_by
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'meetups'
    AND att.attname = 'created_by'
    AND con.contype = 'f';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.meetups DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

ALTER TABLE public.meetups
ADD CONSTRAINT meetups_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ============================================================
-- MEETUP_SIGNUPS TABLE
-- ============================================================
-- Find and drop existing constraint for user_id
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'meetup_signups'
    AND att.attname = 'user_id'
    AND con.contype = 'f';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.meetup_signups DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

ALTER TABLE public.meetup_signups
ADD CONSTRAINT meetup_signups_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ============================================================
-- COFFEE_CHATS TABLE
-- ============================================================
-- Find and drop existing constraints for requester_id and recipient_id
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Fix requester_id
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'coffee_chats'
    AND att.attname = 'requester_id'
    AND con.contype = 'f';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.coffee_chats DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;

    -- Fix recipient_id
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'coffee_chats'
    AND att.attname = 'recipient_id'
    AND con.contype = 'f';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.coffee_chats DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

ALTER TABLE public.coffee_chats
ADD CONSTRAINT coffee_chats_requester_id_fkey
FOREIGN KEY (requester_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE public.coffee_chats
ADD CONSTRAINT coffee_chats_recipient_id_fkey
FOREIGN KEY (recipient_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ============================================================
-- USER_INTERESTS TABLE
-- ============================================================
-- Find and drop existing constraint for user_id
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'user_interests'
    AND att.attname = 'user_id'
    AND con.contype = 'f';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.user_interests DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

ALTER TABLE public.user_interests
ADD CONSTRAINT user_interests_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ============================================================
-- VIDEO_ROOMS TABLE (if it exists)
-- ============================================================
-- Find and drop existing constraint for created_by
DO $$
DECLARE
    constraint_name TEXT;
    table_exists BOOLEAN;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'video_rooms'
    ) INTO table_exists;

    IF table_exists THEN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'video_rooms'
        AND att.attname = 'created_by'
        AND con.contype = 'f';

        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.video_rooms DROP CONSTRAINT IF EXISTS %I', constraint_name);

            -- Add CASCADE constraint
            EXECUTE 'ALTER TABLE public.video_rooms
                     ADD CONSTRAINT video_rooms_created_by_fkey
                     FOREIGN KEY (created_by)
                     REFERENCES auth.users(id)
                     ON DELETE CASCADE';
        END IF;
    END IF;
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Show all foreign keys to auth.users and their delete actions
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  att.attname AS column_name,
  CASE confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE ✓'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS delete_action
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
WHERE confrelid = 'auth.users'::regclass
AND con.contype = 'f'
ORDER BY table_name, column_name;

-- All done! Now you should be able to delete users without errors.
