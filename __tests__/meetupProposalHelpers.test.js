/**
 * Tests for lib/meetupProposalHelpers.js — meetup proposal CRUD.
 *
 * These functions accept supabase as a parameter (no module-level import),
 * so mocking is straightforward.
 */

import { createMockSupabase } from './helpers/mockSupabase'
import {
  submitMeetupProposal,
  getMyProposals,
  getAllProposals,
  getPendingProposals,
  updateMyProposal,
  deleteMyProposal,
  getProposalById,
} from '@/lib/meetupProposalHelpers'

function makeSB(tableData = {}, user = { id: 'u1' }) {
  // Build a chainable mock with per-call table responses
  const calls = { from: [] }
  const chain = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'not', 'or', 'gte', 'order', 'limit', 'contains']
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain) })
  chain.single = jest.fn().mockResolvedValue(tableData.single || { data: null, error: null })
  chain.then = (resolve) => resolve(tableData.list || { data: [], error: null })

  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from: jest.fn().mockReturnValue(chain),
    _chain: chain,
  }
}

describe('submitMeetupProposal', () => {
  test('creates proposal with correct fields', async () => {
    const proposal = { id: 'p1', topic: 'AI Workshop', status: 'pending' }
    const sb = makeSB({ single: { data: proposal, error: null } })

    const result = await submitMeetupProposal(sb, {
      topic: '  AI Workshop  ',
      date: '2026-04-15',
      time: '14:00',
      duration: 90,
      participant_limit: 50,
      description: 'Learn AI',
      vibe_category: 'grow',
    })

    expect(result).toEqual(proposal)
    expect(sb.from).toHaveBeenCalledWith('meetup_proposals')
    expect(sb._chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'AI Workshop',
      duration: 90,
      participant_limit: 50,
      status: 'pending',
    }))
  })

  test('uses defaults for optional fields', async () => {
    const sb = makeSB({ single: { data: { id: 'p1' }, error: null } })

    await submitMeetupProposal(sb, { topic: 'Test', date: '2026-04-15', time: '10:00' })

    expect(sb._chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      duration: 60,
      participant_limit: 100,
      description: null,
      vibe_category: null,
    }))
  })

  test('throws when not authenticated', async () => {
    const sb = makeSB({}, null)
    await expect(submitMeetupProposal(sb, { topic: 'Test' })).rejects.toThrow('Not authenticated')
  })

  test('throws on database error', async () => {
    const sb = makeSB({ single: { data: null, error: { message: 'fail' } } })
    await expect(submitMeetupProposal(sb, { topic: 'Test', date: '2026-04-15', time: '10:00' })).rejects.toBeTruthy()
  })
})

describe('getMyProposals', () => {
  test('returns user proposals', async () => {
    const proposals = [{ id: 'p1', topic: 'A' }]
    const sb = makeSB({ list: { data: proposals, error: null } })

    const result = await getMyProposals(sb)
    expect(result).toEqual(proposals)
  })

  test('returns empty when not authenticated', async () => {
    const sb = makeSB({}, null)
    expect(await getMyProposals(sb)).toEqual([])
  })

  test('returns empty on error', async () => {
    const sb = makeSB({ list: { data: null, error: { message: 'fail' } } })
    expect(await getMyProposals(sb)).toEqual([])
  })
})

describe('getAllProposals', () => {
  test('returns all proposals with proposer attached', async () => {
    const proposals = [
      { id: 'p1', user_id: 'u1', topic: 'A' },
      { id: 'p2', user_id: 'u2', topic: 'B' },
      { id: 'p3', user_id: 'u1', topic: 'C' }, // same proposer as p1
    ]
    const sb = makeSB({ list: { data: proposals, error: null } })

    const result = await getAllProposals(sb)

    expect(result).toHaveLength(3)
    // Each proposal should have a `proposer` field (null is OK — the mock
    // returns proposals data for the second query, but the code still
    // attaches a `proposer` key on every row).
    result.forEach(r => {
      expect(r).toHaveProperty('proposer')
    })
  })

  test('batch-queries profiles once, not per proposal (N+1 regression guard)', async () => {
    const proposals = [
      { id: 'p1', user_id: 'u1' },
      { id: 'p2', user_id: 'u2' },
      { id: 'p3', user_id: 'u1' }, // duplicate proposer — should not cause extra queries
    ]
    const sb = makeSB({ list: { data: proposals, error: null } })

    await getAllProposals(sb)

    // Must call from('profiles') exactly once, regardless of proposal count.
    // The old implementation called it N times inside a for loop.
    const profilesCalls = sb.from.mock.calls.filter(c => c[0] === 'profiles').length
    expect(profilesCalls).toBe(1)

    // Must batch via .in(), not .eq() per id
    expect(sb._chain.in).toHaveBeenCalledWith('id', expect.arrayContaining(['u1', 'u2']))
    // And the id list must be deduplicated (u1 appears twice in proposals → once in query)
    const inCall = sb._chain.in.mock.calls.find(c => c[0] === 'id')
    expect(inCall[1]).toHaveLength(2)
  })

  test('skips profile fetch entirely when there are no proposals', async () => {
    const sb = makeSB({ list: { data: [], error: null } })

    const result = await getAllProposals(sb)

    expect(result).toEqual([])
    // No call to from('profiles') — no ids to look up
    const profilesCalls = sb.from.mock.calls.filter(c => c[0] === 'profiles').length
    expect(profilesCalls).toBe(0)
  })

  test('returns empty on error', async () => {
    const sb = makeSB({ list: { data: null, error: { message: 'fail' } } })
    expect(await getAllProposals(sb)).toEqual([])
  })
})

describe('getProposalById', () => {
  test('returns single proposal', async () => {
    const proposal = { id: 'p1', topic: 'AI', user_id: 'u1' }
    const sb = makeSB({ single: { data: proposal, error: null }, list: { data: [], error: null } })

    const result = await getProposalById(sb, 'p1')
    expect(result).toBeDefined()
    expect(sb.from).toHaveBeenCalledWith('meetup_proposals')
  })

  test('returns null when not found (PGRST116)', async () => {
    const sb = makeSB({ single: { data: null, error: { code: 'PGRST116' } } })
    expect(await getProposalById(sb, 'p1')).toBeNull()
  })

  test('returns null on other errors', async () => {
    const sb = makeSB({ single: { data: null, error: { code: 'OTHER', message: 'fail' } } })
    expect(await getProposalById(sb, 'p1')).toBeNull()
  })
})

describe('updateMyProposal', () => {
  test('updates proposal fields', async () => {
    const sb = makeSB({ list: { data: null, error: null } })

    await updateMyProposal(sb, 'p1', { topic: 'Updated' })
    expect(sb._chain.update).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Updated' }))
  })

  test('throws on error', async () => {
    const sb = makeSB({ list: { data: null, error: { message: 'fail' } } })
    await expect(updateMyProposal(sb, 'p1', {})).rejects.toBeTruthy()
  })
})

describe('deleteMyProposal', () => {
  test('deletes proposal', async () => {
    const sb = makeSB({ list: { data: null, error: null } })

    await deleteMyProposal(sb, 'p1')
    expect(sb.from).toHaveBeenCalledWith('meetup_proposals')
    expect(sb._chain.delete).toHaveBeenCalled()
  })

  test('throws on error', async () => {
    const sb = makeSB({ list: { data: null, error: { message: 'fail' } } })
    await expect(deleteMyProposal(sb, 'p1')).rejects.toBeTruthy()
  })
})
