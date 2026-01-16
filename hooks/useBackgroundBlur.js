'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useBackgroundBlur - Unified background blur hook for all video providers
 *
 * Supports:
 * - Agora (via agora-extension-virtual-background)
 * - LiveKit (via @livekit/track-processors)
 * - WebRTC (via MediaPipe Selfie Segmentation)
 */
export function useBackgroundBlur(provider = 'webrtc') {
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [isBlurSupported, setIsBlurSupported] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const processorRef = useRef(null);
  const segmenterRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Check if blur is supported
  useEffect(() => {
    // Background blur requires modern browser features
    const isSupported = typeof OffscreenCanvas !== 'undefined' ||
                        typeof HTMLCanvasElement !== 'undefined';
    setIsBlurSupported(isSupported);
  }, []);

  /**
   * Initialize MediaPipe for WebRTC blur
   */
  const initMediaPipeBlur = useCallback(async (videoTrack) => {
    try {
      setIsLoading(true);
      setError(null);

      // Dynamically import MediaPipe
      const { SelfieSegmentation } = await import('@mediapipe/selfie_segmentation');

      const selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        }
      });

      selfieSegmentation.setOptions({
        modelSelection: 1, // 0 = general, 1 = landscape (better for video calls)
        selfieMode: true,
      });

      // Create canvas for processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvasRef.current = { canvas, ctx };

      // Set up video element to capture frames
      const video = document.createElement('video');
      video.srcObject = new MediaStream([videoTrack]);
      video.autoplay = true;
      video.playsInline = true;

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          resolve();
        };
      });

      // Process frames
      selfieSegmentation.onResults((results) => {
        if (!canvasRef.current) return;
        const { canvas, ctx } = canvasRef.current;

        // Draw blurred background
        ctx.save();
        ctx.filter = 'blur(10px)';
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Draw person (foreground) using mask
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Draw original person on top
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      });

      // Animation loop
      const processFrame = async () => {
        if (!isBlurEnabled) return;
        await selfieSegmentation.send({ image: video });
        animationFrameRef.current = requestAnimationFrame(processFrame);
      };

      segmenterRef.current = selfieSegmentation;

      // Return the canvas stream
      const blurredStream = canvas.captureStream(30);
      return blurredStream.getVideoTracks()[0];

    } catch (err) {
      console.error('[BackgroundBlur] MediaPipe init error:', err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isBlurEnabled]);

  /**
   * Initialize Agora virtual background
   */
  const initAgoraBlur = useCallback(async (agoraClient, videoTrack) => {
    try {
      setIsLoading(true);
      setError(null);

      // Dynamically import Agora extension
      const VirtualBackgroundExtension = (await import('agora-extension-virtual-background')).default;
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

      // Register extension
      const extension = new VirtualBackgroundExtension();
      AgoraRTC.registerExtensions([extension]);

      // Create and initialize processor
      const processor = extension.createProcessor();
      await processor.init();

      // Configure blur
      processor.setOptions({
        type: 'blur',
        blurDegree: 2, // 1 = low, 2 = medium, 3 = high
      });

      // Pipe video through processor
      videoTrack.pipe(processor).pipe(videoTrack.processorDestination);
      await processor.enable();

      processorRef.current = processor;
      console.log('[BackgroundBlur] Agora blur enabled');

      return true;
    } catch (err) {
      console.error('[BackgroundBlur] Agora init error:', err);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initialize LiveKit background blur
   */
  const initLiveKitBlur = useCallback(async (videoTrack) => {
    try {
      setIsLoading(true);
      setError(null);

      // Dynamically import LiveKit processor
      const { BackgroundBlur } = await import('@livekit/track-processors');

      // Create blur processor
      const blurProcessor = BackgroundBlur(10); // blur radius

      // Apply to video track
      await videoTrack.setProcessor(blurProcessor);

      processorRef.current = blurProcessor;
      console.log('[BackgroundBlur] LiveKit blur enabled');

      return true;
    } catch (err) {
      console.error('[BackgroundBlur] LiveKit init error:', err);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Enable background blur
   */
  const enableBlur = useCallback(async (videoTrack, agoraClient = null) => {
    if (!isBlurSupported) {
      setError('Background blur is not supported on this device');
      return false;
    }

    let success = false;

    switch (provider) {
      case 'agora':
        success = await initAgoraBlur(agoraClient, videoTrack);
        break;
      case 'livekit':
        success = await initLiveKitBlur(videoTrack);
        break;
      case 'webrtc':
      default:
        const blurredTrack = await initMediaPipeBlur(videoTrack);
        success = !!blurredTrack;
        break;
    }

    if (success) {
      setIsBlurEnabled(true);
    }

    return success;
  }, [provider, isBlurSupported, initAgoraBlur, initLiveKitBlur, initMediaPipeBlur]);

  /**
   * Disable background blur
   */
  const disableBlur = useCallback(async (videoTrack) => {
    try {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (segmenterRef.current) {
        segmenterRef.current.close();
        segmenterRef.current = null;
      }

      if (processorRef.current) {
        if (provider === 'agora') {
          await processorRef.current.disable();
        } else if (provider === 'livekit' && videoTrack) {
          await videoTrack.stopProcessor();
        }
        processorRef.current = null;
      }

      setIsBlurEnabled(false);
      console.log('[BackgroundBlur] Blur disabled');
      return true;
    } catch (err) {
      console.error('[BackgroundBlur] Disable error:', err);
      return false;
    }
  }, [provider]);

  /**
   * Toggle background blur
   */
  const toggleBlur = useCallback(async (videoTrack, agoraClient = null) => {
    if (isBlurEnabled) {
      return await disableBlur(videoTrack);
    } else {
      return await enableBlur(videoTrack, agoraClient);
    }
  }, [isBlurEnabled, enableBlur, disableBlur]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (segmenterRef.current) {
        segmenterRef.current.close();
      }
    };
  }, []);

  return {
    isBlurEnabled,
    isBlurSupported,
    isLoading,
    error,
    enableBlur,
    disableBlur,
    toggleBlur,
  };
}

export default useBackgroundBlur;
