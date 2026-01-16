# Debugging Connection Groups Issues

## Problem: Group invitations not showing up

### Steps to Fix and Debug

## 1. Apply the Complete Fix

Run the complete fix SQL in Supabase SQL Editor:
```sql
-- Open file: database-migration-connection-groups-complete-fix.sql
-- Copy all contents and run in Supabase SQL Editor
```

This will:
- Remove all existing problematic policies
- Create helper functions to avoid circular references
- Set up proper policies for viewing groups and invitations
- Allow invited users to see groups they've been invited to

## 2. Check Browser Console

Open the browser console (F12) and look for these logs when:

### When Creator Creates a Group:
```
✅ Group created: [group-id]
✅ Members invited successfully
```

### When Loading Groups (Creator's View):
```
📋 Loading connection groups...
✅ Loaded [X] connection groups
```

### When Loading Invitations (Invited User's View):
```
📨 Loading pending group invitations...
✅ Found [X] pending invitations
```

## 3. Check Database Directly

Run these queries in Supabase SQL Editor to verify data is being created:

### Check if groups were created:
```sql
SELECT * FROM connection_groups ORDER BY created_at DESC LIMIT 5;
```

### Check if memberships were created:
```sql
SELECT
  cgm.*,
  cg.name as group_name,
  p.name as user_name
FROM connection_group_members cgm
JOIN connection_groups cg ON cgm.group_id = cg.id
JOIN profiles p ON cgm.user_id = p.id
ORDER BY cgm.invited_at DESC
LIMIT 10;
```

### Check if you can see invitations with current user:
```sql
-- First get your user ID
SELECT auth.uid();

-- Then check what you can see
SELECT * FROM connection_group_members
WHERE user_id = '[YOUR-USER-ID]';
```

## 4. Common Issues and Solutions

### Issue: "infinite recursion detected in policy"
**Solution**: Run `database-migration-connection-groups-complete-fix.sql`

### Issue: Creator can't see the group after creating it
**Cause**: Creator membership wasn't added or RLS policy blocking it
**Solution**:
1. Check if creator was added to `connection_group_members` with `status='accepted'`
2. Verify policy "select_own_created_groups" exists

### Issue: Invited user can't see invitation
**Cause**: RLS policy only allows 'accepted' members to view groups
**Solution**: The complete fix adds policy "select_member_or_invited_groups" that includes 'invited' status

### Issue: Can create group but error during member insertion
**Cause**: RLS policy blocking insertion of member records
**Solution**: Verify policy "insert_memberships_as_creator" exists and helper function "is_group_creator" works

## 5. Test Step by Step

### Test 1: Create a Group
1. Log in as User A (must have 2+ connections)
2. Go to "Groups" tab
3. Click "Create New Group"
4. Select 2-3 connections
5. Enter a group name
6. Click "Create Group"
7. **Expected**: Success message, group appears in "My Groups" tab

### Test 2: View Invitation
1. Log in as User B (one of the invited users)
2. Go to "Groups" tab
3. Check "Invitations" tab
4. **Expected**: See the group invitation with Accept/Decline buttons

### Test 3: Accept Invitation
1. As User B, click "Accept" on the invitation
2. **Expected**: Success message, group moves to "My Groups" tab

### Test 4: Join Video Call
1. As either User A or User B (after accepting)
2. Click "Join Video Call" button on the group
3. **Expected**: Redirected to video call page with camera/mic prompt

## 6. If Nothing Works

### Reset Everything:
```sql
-- WARNING: This will delete all connection groups data!

-- Drop all tables
DROP TABLE IF EXISTS connection_group_rooms CASCADE;
DROP TABLE IF EXISTS connection_group_members CASCADE;
DROP TABLE IF EXISTS connection_groups CASCADE;

-- Re-run the original migration
-- database-migration-connection-groups.sql

-- Then immediately run the fix
-- database-migration-connection-groups-complete-fix.sql
```

## 7. Enable Detailed Logging

To see more detailed logs, open ConnectionGroupsView.js and add console.logs:

```javascript
const loadConnectionGroups = async () => {
  try {
    console.log('🔍 Starting to load connection groups...');
    const groups = await getMyConnectionGroups();
    console.log('🔍 Raw groups data:', groups);
    setConnectionGroups(groups);
  } catch (error) {
    console.error('❌ Error loading groups:', error);
    console.error('❌ Error details:', error.message, error.code);
  }
};
```

## 8. Contact Info

If issues persist after trying all steps:
1. Check browser console for errors
2. Check Supabase logs for RLS policy errors
3. Verify all migrations were run successfully
4. Check if real-time subscriptions are enabled in Supabase project settings
