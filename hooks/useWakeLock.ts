// hooks/useWakeLock.ts
// Prevents phone screen from sleeping during video call

import { useEffect, useRef } from 'react';

export const useWakeLock = (enabled: boolean = true) => {
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const requestWakeLock = async () => {
      try {
        // Check if Wake Lock API is supported
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('[CircleW] Wake lock activated - screen will stay on');

          wakeLockRef.current.addEventListener('release', () => {
            console.log('[CircleW] Wake lock released');
          });
        } else {
          console.log('[CircleW] Wake Lock API not supported on this device');
        }
      } catch (err) {
        console.error('[CircleW] Wake lock error:', err);
      }
    };

    requestWakeLock();

    // Re-acquire wake lock when page becomes visible
    const handleVisibilityChange = async () => {
      if (!document.hidden && wakeLockRef.current?.released) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          console.log('[CircleW] Wake lock released on cleanup');
          wakeLockRef.current = null;
        });
      }
    };
  }, [enabled]);

  return wakeLockRef;
};
