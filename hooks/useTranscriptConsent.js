'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const FIRST_TIMEOUT_MS = 30000;
const RETRY_TIMEOUT_MS = 60000;
const MAX_ATTEMPTS = 2;

/**
 * Hook for managing transcript consent flow.
 *
 * For 'mutual' mode (1:1 coffee chats): requires both parties to agree.
 * For 'host' mode (group calls): host enables, participants are notified.
 *
 * Uses Supabase Realtime broadcast as primary signaling and a DB row
 * (call_consent table) as source of truth for reliability/rejoin recovery.
 */
export default function useTranscriptConsent({
  roomId,
  userId,
  userName,
  callType,
  consentMode,
  userPreference = 'ask',
  supabase,
  isJoined,
  onAutoAccepted,
  onAutoDeclined,
}) {
  const [consentStatus, setConsentStatus] = useState(null);
  const [consentRequester, setConsentRequester] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);

  const channelRef = useRef(null);
  const timeoutRef = useRef(null);
  const isRequesterRef = useRef(false);

  // Recover consent state from DB on join
  useEffect(() => {
    if (!isJoined || !roomId || !supabase) return;

    const recoverState = async () => {
      const { data } = await supabase
        .from('call_consent')
        .select('*')
        .eq('channel_name', roomId)
        .maybeSingle();

      if (data) {
        // Only recover rows less than 2 hours old (stale rows from previous calls are ignored)
        const rowAge = Date.now() - new Date(data.created_at).getTime();
        const TWO_HOURS = 2 * 60 * 60 * 1000;
        if (rowAge > TWO_HOURS) {
          // Stale row, clean it up
          await supabase.from('call_consent').delete().eq('channel_name', roomId);
          return;
        }

        setConsentStatus(data.status);
        setAttemptCount(data.attempt_count);
        if (data.requester_id === userId) {
          isRequesterRef.current = true;
        }
        if (data.requester_id !== userId && data.status === 'pending') {
          setConsentRequester(data.requester_name || 'Someone');
        }
      }
    };

    recoverState();
  }, [isJoined, roomId, userId, supabase]);

  // Set up broadcast channel
  useEffect(() => {
    if (!isJoined || !roomId || !supabase) return;

    const channel = supabase.channel(`transcript-consent-${roomId}`);

    channel.on('broadcast', { event: 'consent-request' }, ({ payload }) => {
      if (payload?.from === userId) return;

      setConsentRequester(payload?.requesterName || 'Someone');

      // Check local user's preference
      if (userPreference === 'always') {
        respondToConsent(true);
        onAutoAccepted?.();
      } else if (userPreference === 'never') {
        respondToConsent(false);
        onAutoDeclined?.();
      } else {
        // 'ask' — show the modal by setting status
        setConsentStatus('incoming');
      }
    });

    channel.on('broadcast', { event: 'consent-response' }, ({ payload }) => {
      if (payload?.from === userId) return;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (payload?.accepted) {
        setConsentStatus('accepted');
      } else {
        const newAttempt = (attemptCount || 0) + 1;
        if (newAttempt >= MAX_ATTEMPTS) {
          setConsentStatus('exhausted');
        } else {
          setConsentStatus('declined');
        }
      }
    });

    channel.on('broadcast', { event: 'consent-cancelled' }, ({ payload }) => {
      if (payload?.from === userId) return;
      setConsentStatus(null);
      setConsentRequester(null);
    });

    channel.on('broadcast', { event: 'transcript-enabled' }, ({ payload }) => {
      if (payload?.from === userId) return;
      // Host-controlled mode: host started transcription
      setConsentStatus('accepted');
    });

    channel.on('broadcast', { event: 'transcript-stopped' }, () => {
      setConsentStatus(null);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [isJoined, roomId, userId, supabase, userPreference]);

  const requestConsent = useCallback(async () => {
    if (!channelRef.current || !supabase) return false;

    if (consentMode === 'host') {
      // Host mode: start immediately, notify others
      setConsentStatus('accepted');
      isRequesterRef.current = true;

      // Write DB row
      await supabase.from('call_consent').upsert({
        channel_name: roomId,
        requester_id: userId,
        requester_name: userName,
        status: 'accepted',
        attempt_count: 1,
      }, { onConflict: 'channel_name' });

      // Notify participants
      channelRef.current.send({
        type: 'broadcast',
        event: 'transcript-enabled',
        payload: { from: userId, requesterName: userName },
      });

      return true;
    }

    // Mutual mode
    const currentAttempt = attemptCount + 1;
    if (currentAttempt > MAX_ATTEMPTS) return false;

    setConsentStatus('pending');
    isRequesterRef.current = true;
    setAttemptCount(currentAttempt);

    // Write or update DB row
    const { error } = await supabase.from('call_consent').upsert({
      channel_name: roomId,
      requester_id: userId,
      requester_name: userName,
      status: 'pending',
      attempt_count: currentAttempt,
    }, { onConflict: 'channel_name' });

    if (error) {
      // UNIQUE violation means another request exists, recover state
      const { data } = await supabase
        .from('call_consent')
        .select('*')
        .eq('channel_name', roomId)
        .maybeSingle();

      if (data?.status === 'accepted') {
        setConsentStatus('accepted');
        return true;
      }
    }

    // Broadcast request
    channelRef.current.send({
      type: 'broadcast',
      event: 'consent-request',
      payload: { from: userId, requesterName: userName },
    });

    // Start timeout
    const timeoutMs = currentAttempt === 1 ? FIRST_TIMEOUT_MS : RETRY_TIMEOUT_MS;
    timeoutRef.current = setTimeout(async () => {
      // Auto-decline on timeout
      await supabase.from('call_consent')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('channel_name', roomId);

      if (currentAttempt >= MAX_ATTEMPTS) {
        setConsentStatus('exhausted');
      } else {
        setConsentStatus('declined');
      }
      timeoutRef.current = null;
    }, timeoutMs);

    return true;
  }, [consentMode, roomId, userId, userName, supabase, attemptCount]);

  const respondToConsent = useCallback(async (accepted) => {
    if (!channelRef.current || !supabase) return;

    setConsentStatus(accepted ? 'accepted' : 'declined');
    setConsentRequester(null);

    // Update DB row
    await supabase.from('call_consent')
      .update({
        responder_id: userId,
        status: accepted ? 'accepted' : 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('channel_name', roomId);

    // Broadcast response
    channelRef.current.send({
      type: 'broadcast',
      event: 'consent-response',
      payload: { from: userId, accepted },
    });
  }, [roomId, userId, supabase]);

  const cancelConsent = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Delete DB row
    if (supabase && isRequesterRef.current) {
      await supabase.from('call_consent')
        .delete()
        .eq('channel_name', roomId);
    }

    // Broadcast cancellation
    channelRef.current?.send({
      type: 'broadcast',
      event: 'consent-cancelled',
      payload: { from: userId },
    });

    setConsentStatus(null);
    setConsentRequester(null);
    isRequesterRef.current = false;
  }, [roomId, userId, supabase]);

  const stopTranscription = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Update DB row
    if (supabase) {
      await supabase.from('call_consent')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('channel_name', roomId);
    }

    // Broadcast stop
    channelRef.current?.send({
      type: 'broadcast',
      event: 'transcript-stopped',
      payload: { from: userId },
    });

    setConsentStatus(null);
  }, [roomId, userId, supabase]);

  const deleteConsentRow = useCallback(async () => {
    if (supabase) {
      await supabase.from('call_consent')
        .delete()
        .eq('channel_name', roomId);
    }
  }, [roomId, supabase]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    consentStatus,
    consentRequester,
    attemptCount,
    isRequester: isRequesterRef.current,
    requestConsent,
    respondToConsent,
    cancelConsent,
    stopTranscription,
    deleteConsentRow,
  };
}
