-- ============================================================================
-- FIX: Meetup Proposals RLS Policies
-- ============================================================================
-- This fixes potential circular dependency issues in RLS policies
-- and ensures admins can see all proposals
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop existing admin policies that might have issues
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all proposals" ON meetup_proposals;
DROP POLICY IF EXISTS "Admins can update proposals" ON meetup_proposals;
DROP POLICY IF EXISTS "Admins can delete proposals" ON meetup_proposals;

-- ============================================================================
-- STEP 2: Create helper function to check if user is admin
-- ============================================================================

-- This avoids circular dependency in RLS policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ============================================================================
-- STEP 3: Recreate admin policies using the helper function
-- ============================================================================

-- Admins can view all proposals
CREATE POLICY "select_all_proposals_as_admin"
  ON meetup_proposals FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can update any proposal (for approval/rejection)
CREATE POLICY "update_proposals_as_admin"
  ON meetup_proposals FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Admins can delete any proposal
CREATE POLICY "delete_proposals_as_admin"
  ON meetup_proposals FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- STEP 4: Verification
-- ============================================================================

-- Check all policies on meetup_proposals
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'meetup_proposals'
ORDER BY policyname;

-- Test if admin can see proposals (run as admin user)
-- SELECT * FROM meetup_proposals;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If admin still can't see proposals:
-- 1. Verify user is admin in profiles table:
--    SELECT id, name, role FROM profiles WHERE id = auth.uid();
--
-- 2. Test the helper function:
--    SELECT is_admin();
--
-- 3. Check if RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'meetup_proposals';
--
-- 4. Check raw data (bypassing RLS as service_role):
--    SELECT COUNT(*) FROM meetup_proposals;
-- ============================================================================
