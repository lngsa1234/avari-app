/**
 * Tests for the batch conversation query pattern in MessagesView.
 *
 * The old N+1 pattern fired 2 queries per matched user.
 * The new batch pattern fetches all messages in 1 query and groups in memory.
 *
 * Covers:
 * - Message grouping by conversation partner
 * - Last message selection (most recent per partner)
 * - Unread count calculation
 * - Edge cases (no messages, messages from non-matched users)
 */

describe('Batch conversation query - message grouping', () => {
  const currentUserId = 'user-me';
  const matchedUserIds = ['user-a', 'user-b', 'user-c'];

  // Simulates the grouping logic from MessagesView.js
  function groupMessages(allMessages, currentUser, matchedIds) {
    const messagesByUser = {};
    const unreadByUser = {};

    (allMessages || []).forEach(msg => {
      const otherUserId = msg.sender_id === currentUser ? msg.receiver_id : msg.sender_id;
      if (!matchedIds.includes(otherUserId)) return;

      if (!messagesByUser[otherUserId]) {
        messagesByUser[otherUserId] = msg;
      }

      if (msg.sender_id === otherUserId && msg.receiver_id === currentUser && msg.read === false) {
        unreadByUser[otherUserId] = (unreadByUser[otherUserId] || 0) + 1;
      }
    });

    return { messagesByUser, unreadByUser };
  }

  test('groups messages by conversation partner', () => {
    const messages = [
      { id: '1', sender_id: 'user-a', receiver_id: currentUserId, created_at: '2026-04-07T10:00:00Z', read: true },
      { id: '2', sender_id: currentUserId, receiver_id: 'user-b', created_at: '2026-04-07T11:00:00Z', read: true },
      { id: '3', sender_id: 'user-c', receiver_id: currentUserId, created_at: '2026-04-07T12:00:00Z', read: false },
    ];

    const { messagesByUser } = groupMessages(messages, currentUserId, matchedUserIds);

    expect(messagesByUser['user-a'].id).toBe('1');
    expect(messagesByUser['user-b'].id).toBe('2');
    expect(messagesByUser['user-c'].id).toBe('3');
  });

  test('selects most recent message as last message (first in desc-ordered array)', () => {
    // Messages ordered by created_at DESC (newest first, matching the query)
    const messages = [
      { id: '3', sender_id: 'user-a', receiver_id: currentUserId, created_at: '2026-04-07T12:00:00Z', read: true },
      { id: '2', sender_id: currentUserId, receiver_id: 'user-a', created_at: '2026-04-07T11:00:00Z', read: true },
      { id: '1', sender_id: 'user-a', receiver_id: currentUserId, created_at: '2026-04-07T10:00:00Z', read: true },
    ];

    const { messagesByUser } = groupMessages(messages, currentUserId, matchedUserIds);

    // First occurrence is the newest (desc order)
    expect(messagesByUser['user-a'].id).toBe('3');
  });

  test('counts unread messages correctly', () => {
    const messages = [
      { id: '1', sender_id: 'user-a', receiver_id: currentUserId, created_at: '2026-04-07T10:00:00Z', read: false },
      { id: '2', sender_id: 'user-a', receiver_id: currentUserId, created_at: '2026-04-07T11:00:00Z', read: false },
      { id: '3', sender_id: 'user-a', receiver_id: currentUserId, created_at: '2026-04-07T12:00:00Z', read: true },
      { id: '4', sender_id: currentUserId, receiver_id: 'user-a', created_at: '2026-04-07T13:00:00Z', read: false },
    ];

    const { unreadByUser } = groupMessages(messages, currentUserId, matchedUserIds);

    // Only messages FROM user-a TO me that are unread
    expect(unreadByUser['user-a']).toBe(2);
    // Sent messages (from me) don't count as unread even if read=false
  });

  test('returns empty objects when no messages exist', () => {
    const { messagesByUser, unreadByUser } = groupMessages([], currentUserId, matchedUserIds);

    expect(Object.keys(messagesByUser)).toHaveLength(0);
    expect(Object.keys(unreadByUser)).toHaveLength(0);
  });

  test('returns empty objects for null input', () => {
    const { messagesByUser, unreadByUser } = groupMessages(null, currentUserId, matchedUserIds);

    expect(Object.keys(messagesByUser)).toHaveLength(0);
    expect(Object.keys(unreadByUser)).toHaveLength(0);
  });

  test('ignores messages from non-matched users', () => {
    const messages = [
      { id: '1', sender_id: 'user-stranger', receiver_id: currentUserId, created_at: '2026-04-07T10:00:00Z', read: false },
      { id: '2', sender_id: 'user-a', receiver_id: currentUserId, created_at: '2026-04-07T11:00:00Z', read: true },
    ];

    const { messagesByUser, unreadByUser } = groupMessages(messages, currentUserId, matchedUserIds);

    expect(messagesByUser['user-stranger']).toBeUndefined();
    expect(messagesByUser['user-a'].id).toBe('2');
    expect(unreadByUser['user-stranger']).toBeUndefined();
  });

  test('handles conversations with no unread messages', () => {
    const messages = [
      { id: '1', sender_id: 'user-a', receiver_id: currentUserId, created_at: '2026-04-07T10:00:00Z', read: true },
      { id: '2', sender_id: 'user-b', receiver_id: currentUserId, created_at: '2026-04-07T11:00:00Z', read: true },
    ];

    const { unreadByUser } = groupMessages(messages, currentUserId, matchedUserIds);

    expect(unreadByUser['user-a']).toBeUndefined();
    expect(unreadByUser['user-b']).toBeUndefined();
  });

  test('multiple conversations with mixed unread counts', () => {
    const messages = [
      { id: '1', sender_id: 'user-a', receiver_id: currentUserId, read: false, created_at: '2026-04-07T10:00:00Z' },
      { id: '2', sender_id: 'user-a', receiver_id: currentUserId, read: false, created_at: '2026-04-07T11:00:00Z' },
      { id: '3', sender_id: 'user-a', receiver_id: currentUserId, read: false, created_at: '2026-04-07T12:00:00Z' },
      { id: '4', sender_id: 'user-b', receiver_id: currentUserId, read: false, created_at: '2026-04-07T13:00:00Z' },
      { id: '5', sender_id: 'user-c', receiver_id: currentUserId, read: true, created_at: '2026-04-07T14:00:00Z' },
    ];

    const { unreadByUser } = groupMessages(messages, currentUserId, matchedUserIds);

    expect(unreadByUser['user-a']).toBe(3);
    expect(unreadByUser['user-b']).toBe(1);
    expect(unreadByUser['user-c']).toBeUndefined(); // All read
  });
});
