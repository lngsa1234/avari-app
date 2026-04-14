-- ============================================================================
-- Feedback: add 'report' category + promote page_context to JSONB
-- ============================================================================
--
-- The user_feedback table was originally created with:
--   category TEXT CHECK (category IN ('bug', 'feature', 'improvement', 'other'))
--   page_context TEXT
--
-- The /api/feedback route was later updated to accept a new 'report' category
-- (for in-call bug reports that carry a diagnostic snapshot), but the DB
-- migration was never applied. This migration catches the schema up.
--
-- Changes:
--   1. Add 'report' to the category CHECK constraint so the /api/feedback
--      route can accept category='report' payloads.
--   2. Change page_context from TEXT to JSONB so diagnostic snapshots can
--      be stored as structured data, queryable via -> / ->> operators in
--      admin analytics.
--
-- The existing data in page_context (which is stored as plain TEXT but
-- happens to be JSON-ish in some places) is converted via CASE expression
-- below. Rows that don't parse as JSON will be wrapped as a JSON string
-- so the migration succeeds without data loss.
--
-- After this migration is applied, the client-side workaround in
-- app/call/[type]/[id]/page.js can be reverted to send category='report'
-- and pageContext as a raw JS object.
-- ============================================================================

BEGIN;

-- Step 1: update the category CHECK constraint
ALTER TABLE user_feedback DROP CONSTRAINT IF EXISTS user_feedback_category_check;
ALTER TABLE user_feedback
  ADD CONSTRAINT user_feedback_category_check
  CHECK (category IN ('bug', 'feature', 'improvement', 'other', 'report'));

-- Step 2: promote page_context from TEXT to JSONB
ALTER TABLE user_feedback
  ALTER COLUMN page_context TYPE JSONB
  USING CASE
    WHEN page_context IS NULL THEN NULL
    WHEN page_context = '' THEN NULL
    WHEN page_context ~ '^\s*[\[{]' THEN page_context::jsonb
    ELSE to_jsonb(page_context)
  END;

-- Step 3: add a GIN index for querying inside the JSONB (optional but cheap)
CREATE INDEX IF NOT EXISTS idx_feedback_page_context_gin
  ON user_feedback USING GIN (page_context);

COMMIT;

-- Verification: after running this, these queries should both return 0 rows
-- (non-zero results mean the migration didn't apply cleanly):
--
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'user_feedback_category_check'
--   AND NOT pg_get_constraintdef(oid) ILIKE '%report%';
--
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'user_feedback' AND column_name = 'page_context'
--   AND data_type != 'jsonb';
