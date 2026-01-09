'use client';

import { useState, useRef } from 'react';

/**
 * Custom hook for recording video calls
 * Uses MediaRecorder API to record the local stream
 */
export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  /**
   * Start recording the call
   * @param {MediaStream} stream - The media stream to record
   */
  const startRecording = async (stream) => {
    try {
      console.log('🔴 Starting recording...');

      if (!stream) {
        throw new Error('No media stream provided');
      }

      streamRef.current = stream;
      chunksRef.current = [];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stopped
      mediaRecorder.onstop = () => {
        console.log('⏹️ Recording stopped');
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        // Download the recording
        const a = document.createElement('a');
        a.href = url;
        a.download = `avari-call-${new Date().toISOString()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRecordingTime(0);
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);

      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('✅ Recording started');

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      throw error;
    }
  };

  /**
   * Stop recording
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('⏹️ Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /**
   * Format recording time as MM:SS
   */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    formatTime,
  };
}
