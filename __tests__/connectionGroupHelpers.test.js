/**
 * Tests for lib/connectionGroupHelpers.js — connection group CRUD and messaging.
 *
 * @jest-environment node
 */

// Mock supabase module
const mockAuth = { getUser: jest.fn() }
const mockChain = {}
const chainMethods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'not', 'or', 'gte', 'order', 'limit', 'contains', 'filter', 'range']
chainMethods.forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain) })
mockChain.single = jest.fn()
mockChain.then = (resolve) => resolve({ data: [], error: null })

const mockFrom = jest.fn().mockReturnValue(mockChain)
const mockRpc = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockAuth,
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}))

jest.mock('@/lib/dateUtils', () => ({
  parseLocalDate: (s) => new Date(s),
}))

const {
  checkGroupEligibility,
  getEligibleConnections,
  createConnectionGroup,
  acceptGroupInvite,
  declineGroupInvite,
  sendGroupMessage,
  getGroupMessages,
  deleteGroupMessage,
} = require('@/lib/connectionGroupHelpers')

describe('checkGroupEligibility', () => {
  test('returns true when user is authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    expect(await checkGroupEligibility()).toBe(true)
  })

  test('returns false when not authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await checkGroupEligibility()).toBe(false)
  })

  test('returns false on error', async () => {
    mockAuth.getUser.mockRejectedValue(new Error('network'))
    expect(await checkGroupEligibility()).toBe(false)
  })
})

describe('getEligibleConnections', () => {
  beforeEach(() => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  })

  test('returns empty when not authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await getEligibleConnections()).toEqual([])
  })

  test('returns empty when fewer than 2 connections', async () => {
    mockRpc.mockResolvedValue({ data: [{ matched_user_id: 'u2' }], error: null })
    expect(await getEligibleConnections()).toEqual([])
  })

  test('returns profiles when 2+ connections exist', async () => {
    mockRpc.mockResolvedValue({
      data: [{ matched_user_id: 'u2' }, { matched_user_id: 'u3' }],
      error: null,
    })
    const profiles = [{ id: 'u2', name: 'Alice' }, { id: 'u3', name: 'Bob' }]
    // Mock the chain to resolve with profiles
    mockChain.then = (resolve) => resolve({ data: profiles, error: null })
    mockChain.single.mockResolvedValue({ data: profiles, error: null })

    const result = await getEligibleConnections()
    expect(result).toEqual(profiles)
  })

  test('returns empty on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } })
    expect(await getEligibleConnections()).toEqual([])
  })
})

describe('createConnectionGroup', () => {
  beforeEach(() => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockClear()
  })

  test('throws when not authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } })
    await expect(createConnectionGroup({
      name: 'Test', invitedUserIds: ['u2', 'u3'],
    })).rejects.toThrow('Not authenticated')
  })

  test('throws when fewer than 2 invitees', async () => {
    await expect(createConnectionGroup({
      name: 'Test', invitedUserIds: ['u2'],
    })).rejects.toThrow('3-10 people')
  })

  test('throws when more than 9 invitees', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `u${i}`)
    await expect(createConnectionGroup({
      name: 'Test', invitedUserIds: ids,
    })).rejects.toThrow('3-10 people')
  })

  test('creates group with valid input', async () => {
    const mockGroup = { id: 'g1', name: 'Test Group' }
    mockChain.single.mockResolvedValue({ data: mockGroup, error: null })
    mockChain.then = (resolve) => resolve({ data: null, error: null })

    const result = await createConnectionGroup({
      name: '  Test Group  ',
      description: 'A group',
      invitedUserIds: ['u2', 'u3'],
    })

    expect(mockFrom).toHaveBeenCalledWith('connection_groups')
    expect(result).toEqual(mockGroup)
  })
})

describe('acceptGroupInvite', () => {
  test('updates status to accepted', async () => {
    mockChain.then = (resolve) => resolve({ error: null })

    await acceptGroupInvite('membership-1')

    expect(mockFrom).toHaveBeenCalledWith('connection_group_members')
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'accepted',
      responded_at: expect.any(String),
    }))
  })

  test('throws on error', async () => {
    mockChain.then = (resolve) => resolve({ error: { message: 'fail' } })
    await expect(acceptGroupInvite('m1')).rejects.toBeTruthy()
  })
})

describe('declineGroupInvite', () => {
  test('updates status to declined', async () => {
    mockChain.then = (resolve) => resolve({ error: null })

    await declineGroupInvite('membership-1')

    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'declined',
    }))
  })

  test('throws on error', async () => {
    mockChain.then = (resolve) => resolve({ error: { message: 'fail' } })
    await expect(declineGroupInvite('m1')).rejects.toBeTruthy()
  })
})

describe('sendGroupMessage', () => {
  test('inserts message and returns data', async () => {
    const mockSb = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'msg-1', message: 'hello' }, error: null }),
          }),
        }),
      }),
    }

    const result = await sendGroupMessage(mockSb, 'g1', '  hello  ')
    expect(result).toEqual({ id: 'msg-1', message: 'hello' })
    expect(mockSb.from).toHaveBeenCalledWith('connection_group_messages')
  })

  test('throws when not authenticated', async () => {
    const mockSb = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
      from: jest.fn(),
    }
    await expect(sendGroupMessage(mockSb, 'g1', 'hi')).rejects.toThrow('Not authenticated')
  })
})

describe('getGroupMessages', () => {
  test('returns messages with user profiles', async () => {
    const messages = [
      { id: 'm1', user_id: 'u1', message: 'hi', created_at: '2026-01-01' },
      { id: 'm2', user_id: 'u2', message: 'hey', created_at: '2026-01-02' },
    ]
    const profiles = [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ]

    let callCount = 0
    const mockSb = {
      from: jest.fn().mockImplementation(() => {
        callCount++
        const chain = {}
        chainMethods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain) })
        chain.single = jest.fn()
        if (callCount === 1) {
          chain.then = (resolve) => resolve({ data: messages, error: null })
        } else {
          chain.then = (resolve) => resolve({ data: profiles, error: null })
        }
        return chain
      }),
    }

    const result = await getGroupMessages(mockSb, 'g1', 50)
    expect(result).toHaveLength(2)
    expect(result[0].user.name).toBe('Alice')
    expect(result[1].user.name).toBe('Bob')
  })

  test('returns empty on error', async () => {
    const chain = {}
    chainMethods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain) })
    chain.then = (resolve) => resolve({ data: null, error: { message: 'fail' } })
    const mockSb = { from: jest.fn().mockReturnValue(chain) }

    const result = await getGroupMessages(mockSb, 'g1')
    expect(result).toEqual([])
  })
})

describe('deleteGroupMessage', () => {
  test('soft deletes message', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    })
    const mockSb = {
      from: jest.fn().mockReturnValue({ update: mockUpdate }),
    }

    await deleteGroupMessage(mockSb, 'msg-1')
    expect(mockSb.from).toHaveBeenCalledWith('connection_group_messages')
    expect(mockUpdate).toHaveBeenCalledWith({ is_deleted: true })
  })

  test('throws on error', async () => {
    const mockSb = {
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'fail' } }),
        }),
      }),
    }
    await expect(deleteGroupMessage(mockSb, 'msg-1')).rejects.toBeTruthy()
  })
})
