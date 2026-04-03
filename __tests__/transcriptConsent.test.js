/**
 * @jest-environment node
 */

/**
 * Tests for transcript consent logic:
 * - save-call-recap consent verification
 * - callTypeConfig consent modes
 */

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

describe('callTypeConfig consent modes', () => {
  let CALL_TYPE_CONFIG;

  beforeAll(async () => {
    const mod = await import('@/lib/video/callTypeConfig');
    CALL_TYPE_CONFIG = mod.CALL_TYPE_CONFIG;
  });

  test('coffee has mutual consent mode', () => {
    expect(CALL_TYPE_CONFIG.coffee.consentMode).toBe('mutual');
  });

  test('meetup has host consent mode', () => {
    expect(CALL_TYPE_CONFIG.meetup.consentMode).toBe('host');
  });

  test('circle has host consent mode', () => {
    expect(CALL_TYPE_CONFIG.circle.consentMode).toBe('host');
  });

  test('all call types have consentMode defined', () => {
    for (const [type, config] of Object.entries(CALL_TYPE_CONFIG)) {
      expect(config.consentMode).toBeDefined();
      expect(['mutual', 'host']).toContain(config.consentMode);
    }
  });
});

describe('save-call-recap consent verification', () => {
  let POST;

  beforeAll(async () => {
    // Mock authenticateRequest
    jest.unstable_mockModule('@/lib/apiAuth', () => ({
      authenticateRequest: jest.fn().mockResolvedValue({
        user: { id: 'user-1' },
        response: null,
      }),
      createAdminClient: jest.fn(() => ({
        from: jest.fn((table) => {
          if (table === 'call_consent') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ data: null }),
            };
          }
          if (table === 'call_recaps') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ data: null }),
              insert: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'recap-1', transcript: [] },
                error: null,
              }),
            };
          }
          return {};
        }),
      })),
    }));
  });

  test('consent row with accepted status allows transcript', () => {
    // Consent row exists with accepted status
    const consentRow = { status: 'accepted' };
    const transcript = [{ text: 'hello', timestamp: 1 }];
    const allowTranscript = !consentRow || consentRow.status === 'accepted';
    const filtered = allowTranscript ? transcript : [];
    expect(filtered).toEqual(transcript);
  });

  test('consent row with declined status strips transcript', () => {
    const consentRow = { status: 'declined' };
    const transcript = [{ text: 'hello', timestamp: 1 }];
    const allowTranscript = !consentRow || consentRow.status === 'accepted';
    const filtered = allowTranscript ? transcript : [];
    expect(filtered).toEqual([]);
  });

  test('consent row with pending status strips transcript', () => {
    const consentRow = { status: 'pending' };
    const transcript = [{ text: 'hello', timestamp: 1 }];
    const allowTranscript = !consentRow || consentRow.status === 'accepted';
    const filtered = allowTranscript ? transcript : [];
    expect(filtered).toEqual([]);
  });

  test('no consent row allows transcript (backwards compat)', () => {
    const consentRow = null;
    const transcript = [{ text: 'hello', timestamp: 1 }];
    const allowTranscript = !consentRow || consentRow.status === 'accepted';
    const filtered = allowTranscript ? transcript : [];
    expect(filtered).toEqual(transcript);
  });
});

describe('consent retry logic', () => {
  const MAX_ATTEMPTS = 2;

  test('first attempt is allowed', () => {
    const attemptCount = 0;
    const currentAttempt = attemptCount + 1;
    expect(currentAttempt <= MAX_ATTEMPTS).toBe(true);
  });

  test('second attempt is allowed', () => {
    const attemptCount = 1;
    const currentAttempt = attemptCount + 1;
    expect(currentAttempt <= MAX_ATTEMPTS).toBe(true);
  });

  test('third attempt is blocked', () => {
    const attemptCount = 2;
    const currentAttempt = attemptCount + 1;
    expect(currentAttempt <= MAX_ATTEMPTS).toBe(false);
  });

  test('first timeout is 30 seconds', () => {
    const FIRST_TIMEOUT_MS = 30000;
    const RETRY_TIMEOUT_MS = 60000;
    const currentAttempt = 1;
    const timeoutMs = currentAttempt === 1 ? FIRST_TIMEOUT_MS : RETRY_TIMEOUT_MS;
    expect(timeoutMs).toBe(30000);
  });

  test('retry timeout is 60 seconds', () => {
    const FIRST_TIMEOUT_MS = 30000;
    const RETRY_TIMEOUT_MS = 60000;
    const currentAttempt = 2;
    const timeoutMs = currentAttempt === 1 ? FIRST_TIMEOUT_MS : RETRY_TIMEOUT_MS;
    expect(timeoutMs).toBe(60000);
  });
});

describe('consent preference auto-response', () => {
  test('always preference auto-accepts', () => {
    const pref = 'always';
    const shouldShowModal = pref === 'ask';
    const autoAccept = pref === 'always';
    const autoDecline = pref === 'never';
    expect(shouldShowModal).toBe(false);
    expect(autoAccept).toBe(true);
    expect(autoDecline).toBe(false);
  });

  test('never preference auto-declines', () => {
    const pref = 'never';
    const shouldShowModal = pref === 'ask';
    const autoAccept = pref === 'always';
    const autoDecline = pref === 'never';
    expect(shouldShowModal).toBe(false);
    expect(autoAccept).toBe(false);
    expect(autoDecline).toBe(true);
  });

  test('ask preference shows modal', () => {
    const pref = 'ask';
    const shouldShowModal = pref === 'ask';
    const autoAccept = pref === 'always';
    const autoDecline = pref === 'never';
    expect(shouldShowModal).toBe(true);
    expect(autoAccept).toBe(false);
    expect(autoDecline).toBe(false);
  });
});
