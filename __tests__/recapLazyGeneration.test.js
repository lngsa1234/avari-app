/**
 * Tests for recap lazy AI generation fallback logic.
 *
 * Verifies that when a recap has no AI summary, the lazy generation:
 * 1. Uses storage transcript if available
 * 2. Falls back to call_transcripts table when storage transcript is empty
 * 3. Skips generation when no transcript source is available
 *
 * This tests the decision logic extracted from CoffeeChatRecapView and
 * CoffeeChatDetailView — both views use the same pattern.
 *
 * @jest-environment node
 */

describe('Recap lazy generation transcript resolution', () => {
  // Simulates the lazy generation transcript resolution logic from both views:
  // CoffeeChatRecapView.js and CoffeeChatDetailView.js
  function resolveTranscriptForGeneration(recapData, dbTranscripts) {
    let transcriptForGeneration = recapData.transcript || [];

    if (transcriptForGeneration.length === 0 && recapData.channel_name) {
      // Fall back to call_transcripts table
      if (dbTranscripts && dbTranscripts.length > 0) {
        transcriptForGeneration = dbTranscripts.map(t => ({
          speakerName: t.speaker_name || 'Speaker',
          text: t.text,
          timestamp: t.timestamp,
        }));
      }
    }

    return {
      transcript: transcriptForGeneration,
      shouldGenerate: !recapData.ai_summary && transcriptForGeneration.length > 0,
      source: transcriptForGeneration.length > 0
        ? (recapData.transcript?.length > 0 ? 'storage' : 'call_transcripts')
        : 'none',
    };
  }

  test('uses storage transcript when available', () => {
    const recap = {
      ai_summary: null,
      transcript: [
        { speakerName: 'Alice', text: 'Hello', timestamp: 1000 },
        { speakerName: 'Bob', text: 'Hi there', timestamp: 2000 },
      ],
      channel_name: 'coffee-abc123',
    };

    const result = resolveTranscriptForGeneration(recap, []);
    expect(result.shouldGenerate).toBe(true);
    expect(result.source).toBe('storage');
    expect(result.transcript).toHaveLength(2);
    expect(result.transcript[0].speakerName).toBe('Alice');
  });

  test('falls back to call_transcripts when storage transcript is empty', () => {
    const recap = {
      ai_summary: null,
      transcript: [],
      channel_name: 'coffee-abc123',
    };
    const dbTranscripts = [
      { speaker_name: 'Alice', text: 'Hello from DB', timestamp: 1000 },
      { speaker_name: 'Bob', text: 'Hi from DB', timestamp: 2000 },
    ];

    const result = resolveTranscriptForGeneration(recap, dbTranscripts);
    expect(result.shouldGenerate).toBe(true);
    expect(result.source).toBe('call_transcripts');
    expect(result.transcript).toHaveLength(2);
    expect(result.transcript[0].speakerName).toBe('Alice');
    expect(result.transcript[0].text).toBe('Hello from DB');
  });

  test('falls back to call_transcripts when storage transcript is null', () => {
    const recap = {
      ai_summary: null,
      transcript: null,
      channel_name: 'coffee-abc123',
    };
    const dbTranscripts = [
      { speaker_name: 'Xueting', text: 'Marketing discussion', timestamp: 1000 },
    ];

    const result = resolveTranscriptForGeneration(recap, dbTranscripts);
    expect(result.shouldGenerate).toBe(true);
    expect(result.source).toBe('call_transcripts');
    expect(result.transcript[0].speakerName).toBe('Xueting');
  });

  test('handles missing speaker_name in call_transcripts gracefully', () => {
    const recap = {
      ai_summary: null,
      transcript: [],
      channel_name: 'coffee-abc123',
    };
    const dbTranscripts = [
      { speaker_name: null, text: 'Hello', timestamp: 1000 },
    ];

    const result = resolveTranscriptForGeneration(recap, dbTranscripts);
    expect(result.shouldGenerate).toBe(true);
    expect(result.transcript[0].speakerName).toBe('Speaker');
  });

  test('skips generation when no transcript source is available', () => {
    const recap = {
      ai_summary: null,
      transcript: [],
      channel_name: 'coffee-abc123',
    };

    const result = resolveTranscriptForGeneration(recap, []);
    expect(result.shouldGenerate).toBe(false);
    expect(result.source).toBe('none');
    expect(result.transcript).toHaveLength(0);
  });

  test('skips generation when AI summary already exists', () => {
    const recap = {
      ai_summary: '{"summary": "Already summarized"}',
      transcript: [{ speakerName: 'Alice', text: 'Hello', timestamp: 1000 }],
      channel_name: 'coffee-abc123',
    };

    const result = resolveTranscriptForGeneration(recap, []);
    expect(result.shouldGenerate).toBe(false);
  });

  test('does not query call_transcripts when storage transcript has data', () => {
    const recap = {
      ai_summary: null,
      transcript: [{ speakerName: 'Alice', text: 'Hello', timestamp: 1000 }],
      channel_name: 'coffee-abc123',
    };
    // Even if DB has transcripts, storage takes priority
    const dbTranscripts = [
      { speaker_name: 'Different', text: 'Should not be used', timestamp: 3000 },
    ];

    const result = resolveTranscriptForGeneration(recap, dbTranscripts);
    expect(result.source).toBe('storage');
    expect(result.transcript).toHaveLength(1);
    expect(result.transcript[0].speakerName).toBe('Alice');
  });

  test('does not attempt fallback when channel_name is missing', () => {
    const recap = {
      ai_summary: null,
      transcript: [],
      channel_name: null,
    };
    const dbTranscripts = [
      { speaker_name: 'Alice', text: 'Should not be used', timestamp: 1000 },
    ];

    // With no channel_name, can't query call_transcripts
    // In the actual code, the query is guarded by `data.channel_name`
    const transcriptForGeneration = recap.transcript || [];
    const shouldFallback = transcriptForGeneration.length === 0 && recap.channel_name;
    expect(shouldFallback).toBeFalsy();
  });
});

describe('Recap source code contract', () => {
  const fs = require('fs');
  const path = require('path');

  function readComponent(name) {
    return fs.readFileSync(path.join(__dirname, '..', 'components', name), 'utf8');
  }

  test('CoffeeChatRecapView falls back to call_transcripts table', () => {
    const src = readComponent('CoffeeChatRecapView.js');
    expect(src).toContain('call_transcripts');
    expect(src).toContain('speaker_name, text, timestamp');
  });

  test('CoffeeChatDetailView falls back to call_transcripts table', () => {
    const src = readComponent('CoffeeChatDetailView.js');
    expect(src).toContain('call_transcripts');
    expect(src).toContain('speaker_name, text, timestamp');
  });

  test('both views check channel_name before querying call_transcripts', () => {
    const recapView = readComponent('CoffeeChatRecapView.js');
    const detailView = readComponent('CoffeeChatDetailView.js');
    // Both should guard the fallback with channel_name check
    expect(recapView).toContain('channel_name');
    expect(detailView).toContain('channel_name');
  });
});
