// lib/activityHelpers.js
// Helper functions for tracking user activity

import { supabase } from './supabase';

// Update the user's last_active timestamp
export async function updateLastActive(userId) {
  if (!userId) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('Error updating last_active:', error);
    }
  } catch (err) {
    console.error('Exception updating last_active:', err);
  }
}

// Check if a user is considered "active" (within last X minutes)
export function isUserActive(lastActiveTimestamp, minutesThreshold = 10) {
  if (!lastActiveTimestamp) return false;

  const lastActive = new Date(lastActiveTimestamp);
  const threshold = new Date(Date.now() - minutesThreshold * 60 * 1000);

  return lastActive > threshold;
}

// Get the count of active users from a list of users
export function countActiveUsers(users, minutesThreshold = 10) {
  if (!users || users.length === 0) return 0;

  return users.filter(user => {
    const lastActive = user.last_active || user.user?.last_active;
    return isUserActive(lastActive, minutesThreshold);
  }).length;
}

// Throttled version to avoid too many database calls
let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 60000; // Only update once per minute

export async function updateLastActiveThrottled(userId) {
  const now = Date.now();

  if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
    return; // Skip if updated recently
  }

  lastUpdateTime = now;
  await updateLastActive(userId);
}
