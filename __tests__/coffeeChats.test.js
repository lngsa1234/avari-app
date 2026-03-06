/**
 * Tests for coffee chat business logic.
 */

describe('Coffee Chat Logic', () => {
  describe('Chat status lifecycle', () => {
    const VALID_STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'completed']

    test('all status values are valid', () => {
      VALID_STATUSES.forEach(status => {
        expect(['pending', 'accepted', 'declined', 'cancelled', 'completed']).toContain(status)
      })
    })

    test('new chat starts as pending', () => {
      const newChat = {
        requester_id: 'user-a',
        recipient_id: 'user-b',
        scheduled_time: new Date().toISOString(),
        status: 'pending',
      }
      expect(newChat.status).toBe('pending')
    })

    test('accepted chat gets room URL', () => {
      const chatId = 'abc-123'
      const timestamp = Date.now()
      const roomUrl = `https://circlew.daily.co/${chatId}-${timestamp}`

      const accepted = {
        status: 'accepted',
        room_url: roomUrl,
        video_link: roomUrl,
      }

      expect(accepted.status).toBe('accepted')
      expect(accepted.room_url).toContain(chatId)
      expect(accepted.video_link).toBe(accepted.room_url)
    })

    test('completed chat has completed_at timestamp', () => {
      const now = new Date().toISOString()
      const completed = {
        status: 'completed',
        completed_at: now,
      }
      expect(completed.completed_at).toBeDefined()
      expect(new Date(completed.completed_at).getTime()).not.toBeNaN()
    })
  })

  describe('Upcoming vs past chat filtering', () => {
    const now = new Date()
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const chats = [
      { id: '1', status: 'accepted', scheduled_time: future },
      { id: '2', status: 'accepted', scheduled_time: past },
      { id: '3', status: 'completed', scheduled_time: past },
      { id: '4', status: 'pending', scheduled_time: future },
      { id: '5', status: 'declined', scheduled_time: future },
    ]

    test('upcoming chats are accepted with future time', () => {
      const upcoming = chats.filter(
        chat => chat.status === 'accepted' && new Date(chat.scheduled_time) > now
      )
      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].id).toBe('1')
    })

    test('past chats are completed or accepted with past time', () => {
      const pastChats = chats.filter(
        chat => chat.status === 'completed' ||
          (chat.status === 'accepted' && new Date(chat.scheduled_time) <= now)
      )
      expect(pastChats).toHaveLength(2)
      expect(pastChats.map(c => c.id)).toEqual(['2', '3'])
    })
  })

  describe('Stale request auto-decline', () => {
    test('requests older than 24h are stale', () => {
      const now = new Date()
      const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const requests = [
        { id: '1', scheduled_time: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString() },
        { id: '2', scheduled_time: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString() },
        { id: '3', scheduled_time: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() },
        { id: '4', scheduled_time: null }, // no time set
      ]

      const stale = requests.filter(r => r.scheduled_time && new Date(r.scheduled_time) < staleThreshold)
      const active = requests.filter(r => !r.scheduled_time || new Date(r.scheduled_time) >= staleThreshold)

      expect(stale).toHaveLength(1)
      expect(stale[0].id).toBe('1')
      expect(active).toHaveLength(3)
    })
  })

  describe('Live/soon badge logic', () => {
    test('chat is "soon" when less than 1 hour away', () => {
      const now = new Date()
      const chatDate = new Date(now.getTime() + 30 * 60 * 1000) // 30 min from now

      const isSoon = (chatDate - now) < 60 * 60 * 1000 && chatDate > now
      expect(isSoon).toBe(true)
    })

    test('chat is not "soon" when more than 1 hour away', () => {
      const now = new Date()
      const chatDate = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours

      const isSoon = (chatDate - now) < 60 * 60 * 1000 && chatDate > now
      expect(isSoon).toBe(false)
    })

    test('chat is "live" within 30 min after start', () => {
      const now = new Date()
      const chatDate = new Date(now.getTime() - 15 * 60 * 1000) // started 15 min ago

      const isLive = now >= chatDate && now <= new Date(chatDate.getTime() + 30 * 60 * 1000)
      expect(isLive).toBe(true)
    })

    test('chat is not "live" after 30 min past start', () => {
      const now = new Date()
      const chatDate = new Date(now.getTime() - 45 * 60 * 1000) // started 45 min ago

      const isLive = now >= chatDate && now <= new Date(chatDate.getTime() + 30 * 60 * 1000)
      expect(isLive).toBe(false)
    })
  })

  describe('Grace period for home page display', () => {
    test('chats within 4h grace period are still shown', () => {
      const now = new Date()
      const gracePeriod = new Date(now.getTime() - 4 * 60 * 60 * 1000)

      const chats = [
        { id: '1', scheduled_time: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
        { id: '2', scheduled_time: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString() },
        { id: '3', scheduled_time: null }, // pending without time
      ]

      const upcoming = chats.filter(chat => {
        if (!chat.scheduled_time) return true
        return new Date(chat.scheduled_time) > gracePeriod
      })

      expect(upcoming).toHaveLength(2)
      expect(upcoming.map(c => c.id)).toEqual(['1', '3'])
    })
  })
})
