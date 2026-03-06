// Mock Supabase client for testing
export function createMockSupabase(mockData = {}) {
  const chainable = (resolvedValue) => {
    const chain = {
      select: jest.fn().mockReturnValue(chain),
      insert: jest.fn().mockReturnValue(chain),
      update: jest.fn().mockReturnValue(chain),
      delete: jest.fn().mockReturnValue(chain),
      eq: jest.fn().mockReturnValue(chain),
      neq: jest.fn().mockReturnValue(chain),
      in: jest.fn().mockReturnValue(chain),
      is: jest.fn().mockReturnValue(chain),
      not: jest.fn().mockReturnValue(chain),
      or: jest.fn().mockReturnValue(chain),
      gte: jest.fn().mockReturnValue(chain),
      order: jest.fn().mockReturnValue(chain),
      limit: jest.fn().mockReturnValue(chain),
      then: (resolve) => resolve(resolvedValue),
    }
    // Make it thenable so await works
    chain[Symbol.for('jest.asymmetricMatch')] = undefined
    return chain
  }

  const rpcResults = mockData.rpc || {}

  return {
    from: jest.fn((table) => {
      const tableData = mockData[table] || { data: [], error: null }
      return chainable(tableData)
    }),
    rpc: jest.fn((fnName, params) => {
      const result = typeof rpcResults[fnName] === 'function'
        ? rpcResults[fnName](params)
        : rpcResults[fnName] || { data: null, error: null }
      return Promise.resolve(result)
    }),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    }),
    removeChannel: jest.fn(),
  }
}

// Common test user fixtures
export const TEST_USERS = {
  admin: {
    id: '5c4eb853-656a-4e1f-b884-120d8499a1b3',
    name: 'Admin',
    career: 'Developer',
    city: 'San Francisco',
    state: 'CA',
    profile_picture: null,
  },
  xueting: {
    id: 'cc9bb9b8-01fc-41aa-a075-bbaeb62ca498',
    name: 'xueting zhou',
    career: 'Marketing Manager',
    city: null,
    state: null,
    profile_picture: null,
  },
  mi: {
    id: '57c05f6e-d18a-4cbb-ab9f-7203a1e69a84',
    name: 'MI',
    career: 'Engineer',
    city: 'New York',
    state: 'NY',
    profile_picture: null,
  },
}
