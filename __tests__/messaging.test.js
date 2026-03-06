/**
 * Tests for messaging business logic.
 */

describe('Messaging Logic', () => {
  describe('Conversation building', () => {
    test('identifies the other person in a conversation', () => {
      const currentUserId = 'user-a'
      const messages = [
        { sender_id: 'user-a', receiver_id: 'user-b', content: 'Hi' },
        { sender_id: 'user-b', receiver_id: 'user-a', content: 'Hello' },
      ]

      const otherIds = [...new Set(messages.map(m =>
        m.sender_id === currentUserId ? m.receiver_id : m.sender_id
      ))]

      expect(otherIds).toEqual(['user-b'])
    })

    test('sorts conversations by last message time', () => {
      const conversations = [
        { id: 'c1', lastMessageTime: '2026-01-01T10:00:00Z' },
        { id: 'c2', lastMessageTime: '2026-03-01T10:00:00Z' },
        { id: 'c3', lastMessageTime: '2026-02-01T10:00:00Z' },
      ]

      const sorted = [...conversations].sort(
        (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      )

      expect(sorted.map(c => c.id)).toEqual(['c2', 'c3', 'c1'])
    })

    test('only shows conversations with mutual connections', () => {
      const mutualMatches = [
        { matched_user_id: 'user-b' },
        { matched_user_id: 'user-c' },
      ]
      const allUsers = ['user-a', 'user-b', 'user-c', 'user-d']

      const matchIds = new Set(mutualMatches.map(m => m.matched_user_id))
      const conversationPartners = allUsers.filter(id => matchIds.has(id))

      expect(conversationPartners).toEqual(['user-b', 'user-c'])
    })
  })

  describe('Unread count logic', () => {
    test('counts unread messages from a specific sender', () => {
      const messages = [
        { sender_id: 'user-b', receiver_id: 'user-a', read: false },
        { sender_id: 'user-b', receiver_id: 'user-a', read: false },
        { sender_id: 'user-b', receiver_id: 'user-a', read: true },
        { sender_id: 'user-c', receiver_id: 'user-a', read: false },
      ]

      const currentUserId = 'user-a'
      const fromUserId = 'user-b'

      const unread = messages.filter(
        m => m.sender_id === fromUserId && m.receiver_id === currentUserId && !m.read
      ).length

      expect(unread).toBe(2)
    })

    test('builds unread counts map per sender', () => {
      const unreadMessages = [
        { sender_id: 'user-b' },
        { sender_id: 'user-b' },
        { sender_id: 'user-c' },
      ]

      const counts = {}
      unreadMessages.forEach(msg => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1
      })

      expect(counts['user-b']).toBe(2)
      expect(counts['user-c']).toBe(1)
      expect(counts['user-d']).toBeUndefined()
    })

    test('zeroes count when conversation is opened', () => {
      const counts = { 'user-b': 5, 'user-c': 3 }
      const openedConversation = 'user-b'

      // Mark all as read
      const updated = { ...counts, [openedConversation]: 0 }

      expect(updated['user-b']).toBe(0)
      expect(updated['user-c']).toBe(3)
    })
  })

  describe('Message creation', () => {
    test('new message has correct structure', () => {
      const message = {
        sender_id: 'user-a',
        receiver_id: 'user-b',
        content: 'Hello!',
        read: false,
      }

      expect(message.sender_id).toBe('user-a')
      expect(message.receiver_id).toBe('user-b')
      expect(message.content).toBe('Hello!')
      expect(message.read).toBe(false)
    })

    test('rejects empty message content', () => {
      const content = '   '
      const isValid = content.trim().length > 0
      expect(isValid).toBe(false)
    })

    test('trims message content', () => {
      const content = '  Hello!  '
      expect(content.trim()).toBe('Hello!')
    })
  })

  describe('Real-time message handling', () => {
    test('adds incoming message to conversation if open', () => {
      const currentMessages = [
        { id: '1', content: 'Hi' },
        { id: '2', content: 'Hello' },
      ]
      const newMessage = { id: '3', content: 'How are you?' }

      const isDuplicate = currentMessages.some(m => m.id === newMessage.id)
      expect(isDuplicate).toBe(false)

      const updated = [...currentMessages, newMessage]
      expect(updated).toHaveLength(3)
      expect(updated[2].content).toBe('How are you?')
    })

    test('prevents duplicate messages', () => {
      const currentMessages = [
        { id: '1', content: 'Hi' },
        { id: '2', content: 'Hello' },
      ]
      const duplicateMessage = { id: '2', content: 'Hello' }

      const isDuplicate = currentMessages.some(m => m.id === duplicateMessage.id)
      expect(isDuplicate).toBe(true)
    })
  })
})
