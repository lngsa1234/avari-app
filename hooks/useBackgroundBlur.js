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
  const videoTrackRef = useRef(null); // Store video track reference for cleanup
  const extensionRef = useRef(null); // Store Agora extension to reuse
  const agoraProcessorReadyRef = useRef(null); // Pre-initialized Agora processor
  const originalTrackRef = useRef(null); // Store original WebRTC track for restore
  const blurActiveRef = useRef(false); // Ref to avoid stale closure in animation loop
  const blurResultRef = useRef(null); // Store WebRTC blur result for caller

  // Check if blur is supported
  useEffect(() => {
    // Background blur requires modern browser features
    const hasCanvas = typeof OffscreenCanvas !== 'undefined' ||
                      typeof HTMLCanvasElement !== 'undefined';

    // Agora virtual background extension does not work on mobile browsers
    // (WASM/ML model fails or performs too poorly on mobile devices)
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isSupported = hasCanvas && !(provider === 'agora' && isMobile);

    setIsBlurSupported(isSupported);
  }, [provider]);

  /**
   * Initialize MediaPipe selfie segmentation blur for WebRTC.
   * Does NOT modify the original MediaStream. Instead returns a canvas stream
   * that the caller can use for display and peer connection.
   * Returns { blurredStream, blurredTrack } or false on failure.
   */
  const initWebRTCBlur = useCallback(async (mediaStream) => {
    let domVideo = null; // Track DOM-attached video for cleanup on error
    try {
      setIsLoading(true);
      setError(null);

      const origTrack = mediaStream.getVideoTracks()[0];
      if (!origTrack) throw new Error('No video track found');
      originalTrackRef.current = origTrack;

      // Get exact dimensions from the track settings
      const settings = origTrack.getSettings();
      const w = settings.width || 1280;
      const h = settings.height || 720;
      console.log('[BackgroundBlur] Using dimensions from track:', w, 'x', h);

      // Output canvas — must be in DOM for Safari captureStream compatibility
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      // Offscreen canvases (compositing only, not captured)
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = w;
      blurCanvas.height = h;
      const blurCtx = blurCanvas.getContext('2d');

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = w;
      maskCanvas.height = h;
      const maskCtx = maskCanvas.getContext('2d');

      // Hidden video element feeding from the original camera track
      // Safari requires the element to be in the DOM for reliable playback
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');
      video.muted = true;
      video.width = w;
      video.height = h;
      video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
      document.body.appendChild(video);
      domVideo = video;
      video.srcObject = new MediaStream([origTrack]);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);
        video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
        video.play().catch((e) => { clearTimeout(timeout); reject(e); });
      });

      // Detect if ctx.filter actually works (not just exists)
      blurCtx.filter = 'blur(1px)';
      const supportsCtxFilter = blurCtx.filter === 'blur(1px)';
      blurCtx.filter = 'none';

      canvasRef.current = { canvas, ctx, video, blurCanvas, blurCtx, maskCanvas, maskCtx };
      blurActiveRef.current = true;

      // Start passthrough immediately so canvas has content from frame 0
      ctx.drawImage(video, 0, 0, w, h);

      // Capture canvas stream for peer connection
      // Must use captureStream(30) — Safari does not support requestFrame()
      let blurredStream = null;
      let blurredTrack = null;
      try {
        blurredStream = canvas.captureStream(30);
        blurredTrack = blurredStream.getVideoTracks()[0];
      } catch (e) {
        console.warn('[BackgroundBlur] captureStream failed:', e.message);
      }

      // Load MediaPipe — selfieMode:false avoids flipping results.image
      const { SelfieSegmentation } = await import('@mediapipe/selfie_segmentation');
      const seg = new SelfieSegmentation({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });
      seg.setOptions({ modelSelection: 1, selfieMode: false });

      let hasSegResult = false;

      seg.onResults((results) => {
        const src = results.image;
        const mask = results.segmentationMask;

        // Blurred background
        if (supportsCtxFilter) {
          blurCtx.filter = 'blur(20px)';
          blurCtx.drawImage(src, 0, 0, w, h);
          blurCtx.filter = 'none';
        } else {
          // Safari fallback: 3x scale-down/up for strong blur approximation
          blurCtx.imageSmoothingEnabled = true;
          blurCtx.imageSmoothingQuality = 'high';
          const sw1 = Math.max(1, Math.round(w / 32));
          const sh1 = Math.max(1, Math.round(h / 32));
          blurCtx.drawImage(src, 0, 0, sw1, sh1);
          blurCtx.drawImage(blurCanvas, 0, 0, sw1, sh1, 0, 0, w, h);
          const sw2 = Math.max(1, Math.round(w / 16));
          const sh2 = Math.max(1, Math.round(h / 16));
          blurCtx.drawImage(blurCanvas, 0, 0, sw2, sh2);
          blurCtx.drawImage(blurCanvas, 0, 0, sw2, sh2, 0, 0, w, h);
          blurCtx.drawImage(blurCanvas, 0, 0, sw2, sh2);
          blurCtx.drawImage(blurCanvas, 0, 0, sw2, sh2, 0, 0, w, h);
        }

        // Sharp person via mask — triple-apply to sharpen soft edges
        maskCtx.clearRect(0, 0, w, h);
        maskCtx.drawImage(src, 0, 0, w, h);
        maskCtx.globalCompositeOperation = 'destination-in';
        maskCtx.drawImage(mask, 0, 0, w, h);
        maskCtx.drawImage(mask, 0, 0, w, h);
        maskCtx.drawImage(mask, 0, 0, w, h);
        maskCtx.globalCompositeOperation = 'source-over';

        // Final composite
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(blurCanvas, 0, 0, w, h);
        ctx.drawImage(maskCanvas, 0, 0, w, h);
        hasSegResult = true;
      });

      segmenterRef.current = seg;

      // Render loop — draws passthrough until segmenter produces results
      let sending = false;
      const tick = () => {
        if (!blurActiveRef.current) return;

        if (video.readyState >= 2) {
          if (!hasSegResult) {
            ctx.drawImage(video, 0, 0, w, h);
          }
          if (!sending) {
            sending = true;
            seg.send({ image: video }).then(() => { sending = false; }).catch(() => { sending = false; });
          }
        }

        animationFrameRef.current = requestAnimationFrame(tick);
      };
      animationFrameRef.current = requestAnimationFrame(tick);

      processorRef.current = { video, blurredTrack, blurredStream, canvas };
      console.log('[BackgroundBlur] WebRTC blur enabled');

      return { canvas, blurredStream, blurredTrack };
    } catch (err) {
      console.error('[BackgroundBlur] WebRTC blur init error:', err);
      setError(err.message);
      // Clean up DOM-attached video on failure
      if (domVideo?.parentElement) {
        domVideo.srcObject = null;
        domVideo.parentElement.removeChild(domVideo);
      }
      blurActiveRef.current = false;
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Pre-load the Agora virtual background extension and processor.
   * Call this during Agora call initialization so the heavy WASM download
   * and compilation happen in the background, not when the user clicks blur.
   */
  const preloadAgoraBlur = useCallback(async () => {
    if (provider !== 'agora') return;
    if (agoraProcessorReadyRef.current) return; // Already preloaded

    try {
      console.log('[BackgroundBlur] Pre-loading Agora virtual background...');
      const VirtualBackgroundExtension = (await import('agora-extension-virtual-background')).default;
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

      if (!extensionRef.current) {
        extensionRef.current = new VirtualBackgroundExtension();
        try {
          AgoraRTC.registerExtensions([extensionRef.current]);
          console.log('[BackgroundBlur] Extension registered (preload)');
        } catch (e) {
          console.log('[BackgroundBlur] Extension registration (preload):', e.message);
        }
      }

      // Create and init processor ahead of time (downloads WASM model)
      const processor = extensionRef.current.createProcessor();
      await processor.init();
      agoraProcessorReadyRef.current = processor;
      console.log('[BackgroundBlur] Agora processor pre-loaded and ready');
    } catch (err) {
      console.warn('[BackgroundBlur] Pre-load failed (will retry on toggle):', err.message);
    }
  }, [provider]);

  /**
   * Initialize Agora virtual background
   */
  const initAgoraBlur = useCallback(async (agoraClient, videoTrack) => {
    try {
      setIsLoading(true);
      setError(null);

      // If we already have a processor, just re-enable it
      if (processorRef.current && videoTrackRef.current === videoTrack) {
        console.log('[BackgroundBlur] Re-enabling existing processor');
        try {
          await processorRef.current.enable();
          console.log('[BackgroundBlur] Agora blur re-enabled');
          return true;
        } catch (e) {
          console.log('[BackgroundBlur] Re-enable failed, will recreate:', e.message);
        }
      }

      // Clean up any existing processors
      try {
        if (processorRef.current) {
          await processorRef.current.disable();
          processorRef.current.unpipe();
        }
      } catch (e) {
        console.log('[BackgroundBlur] Processor cleanup:', e.message);
      }

      // Unpipe the video track to clear any piped processors
      try {
        videoTrack.unpipe();
      } catch (e) {
        console.log('[BackgroundBlur] Track unpipe:', e.message);
      }
      processorRef.current = null;
      console.log('[BackgroundBlur] Cleanup complete');

      // Use pre-loaded processor if available, otherwise load on demand
      let processor = agoraProcessorReadyRef.current;
      if (processor) {
        console.log('[BackgroundBlur] Using pre-loaded processor');
        agoraProcessorReadyRef.current = null; // Consume it
      } else {
        console.log('[BackgroundBlur] Processor not pre-loaded, loading now...');
        const VirtualBackgroundExtension = (await import('agora-extension-virtual-background')).default;
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

        if (!extensionRef.current) {
          extensionRef.current = new VirtualBackgroundExtension();
          try {
            AgoraRTC.registerExtensions([extensionRef.current]);
            console.log('[BackgroundBlur] Extension registered');
          } catch (e) {
            console.log('[BackgroundBlur] Extension registration:', e.message);
          }
        }

        processor = extensionRef.current.createProcessor();
        await processor.init();
      }

      // Configure blur
      processor.setOptions({
        type: 'blur',
        blurDegree: 2, // 1 = low, 2 = medium, 3 = high
      });

      // Pipe video through processor
      videoTrack.pipe(processor).pipe(videoTrack.processorDestination);
      await processor.enable();

      processorRef.current = processor;
      videoTrackRef.current = videoTrack; // Store reference for cleanup
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
   * Uses a freeze-frame overlay to prevent black flash during processor swap.
   */
  const initLiveKitBlur = useCallback(async (videoTrack) => {
    try {
      setIsLoading(true);
      setError(null);

      // Capture a freeze-frame before applying the processor so the
      // user sees the last good frame instead of a black flash.
      const attachedEl = videoTrack.attachedElements?.[0];
      let freezeCanvas = null;
      if (attachedEl && attachedEl.videoWidth) {
        freezeCanvas = document.createElement('canvas');
        freezeCanvas.width = attachedEl.videoWidth;
        freezeCanvas.height = attachedEl.videoHeight;
        freezeCanvas.getContext('2d').drawImage(attachedEl, 0, 0);
        // Overlay the frozen frame on top of the video element
        Object.assign(freezeCanvas.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: '999',
          borderRadius: 'inherit',
          transform: 'scaleX(-1)',
          pointerEvents: 'none',
        });
        attachedEl.parentElement?.appendChild(freezeCanvas);
      }

      // Dynamically import LiveKit processor
      const { BackgroundBlur } = await import('@livekit/track-processors');

      // Create blur processor
      const blurProcessor = BackgroundBlur(10); // blur radius

      // Apply to video track (this causes a brief track restart)
      await videoTrack.setProcessor(blurProcessor);

      // Remove freeze-frame after a short delay to let the new track render
      if (freezeCanvas) {
        setTimeout(() => freezeCanvas.remove(), 200);
      }

      processorRef.current = blurProcessor;
      console.log('[BackgroundBlur] LiveKit blur enabled');

      return true;
    } catch (err) {
      console.error('[BackgroundBlur] LiveKit init error:', err);
      // Clean up freeze-frame on error
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
      default: {
        const result = await initWebRTCBlur(videoTrack);
        // For WebRTC, result is { blurredStream, blurredTrack } or false
        success = !!result;
        if (result) {
          blurResultRef.current = result;
        }
        break;
      }
    }

    if (success) {
      setIsBlurEnabled(true);
    }

    return success;
  }, [provider, isBlurSupported, initAgoraBlur, initLiveKitBlur, initWebRTCBlur]);

  /**
   * Disable background blur
   */
  const disableBlur = useCallback(async (videoTrack) => {
    try {
      blurActiveRef.current = false;

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
          // Just disable, don't unpipe - allows re-enabling without re-piping
          await processorRef.current.disable();
          console.log('[BackgroundBlur] Agora processor disabled (kept for re-enable)');
          // Don't clear processorRef so we can re-enable
        } else if (provider === 'livekit' && videoTrack) {
          // Freeze-frame to prevent black flash when removing processor
          const attachedEl = videoTrack.attachedElements?.[0];
          let freezeCanvas = null;
          if (attachedEl && attachedEl.videoWidth) {
            freezeCanvas = document.createElement('canvas');
            freezeCanvas.width = attachedEl.videoWidth;
            freezeCanvas.height = attachedEl.videoHeight;
            freezeCanvas.getContext('2d').drawImage(attachedEl, 0, 0);
            Object.assign(freezeCanvas.style, {
              position: 'absolute', inset: '0', width: '100%', height: '100%',
              objectFit: 'cover', zIndex: '999', borderRadius: 'inherit',
              transform: 'scaleX(-1)', pointerEvents: 'none',
            });
            attachedEl.parentElement?.appendChild(freezeCanvas);
          }
          await videoTrack.stopProcessor();
          if (freezeCanvas) setTimeout(() => freezeCanvas.remove(), 200);
          processorRef.current = null;
        } else if (provider === 'webrtc') {
          // Stop the blurred track and clean up
          const blurredTrack = processorRef.current?.blurredTrack;
          if (blurredTrack) {
            blurredTrack.stop();
          }
          if (processorRef.current?.video) {
            processorRef.current.video.srcObject = null;
            if (processorRef.current.video.parentElement) {
              processorRef.current.video.parentElement.removeChild(processorRef.current.video);
            }
          }
          // originalTrackRef is still valid — caller uses it to restore
          processorRef.current = null;
          blurResultRef.current = null;
          console.log('[BackgroundBlur] WebRTC blur disabled');
        } else {
          processorRef.current = null;
        }
      }

      if (canvasRef.current) {
        canvasRef.current = null;
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
    blurResult: blurResultRef,
    preloadAgoraBlur,
  };
}

export default useBackgroundBlur;
