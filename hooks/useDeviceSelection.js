'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing camera and audio device selection
 * Provides device enumeration, selection, and switching capabilities
 */
export default function useDeviceSelection() {
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [hasPermission, setHasPermission] = useState(false);

  // Enumerate available devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      setVideoDevices(videoInputs);
      setAudioDevices(audioInputs);

      // Set defaults if not already selected
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }

      // Check if we have real device labels (indicates permission granted)
      const hasLabels = devices.some(d => d.label && d.label.length > 0);
      setHasPermission(hasLabels);

      return { videoInputs, audioInputs };
    } catch (error) {
      console.error('[useDeviceSelection] Error enumerating devices:', error);
      return { videoInputs: [], audioInputs: [] };
    }
  }, [selectedVideoDevice, selectedAudioDevice]);

  // Initial enumeration and device change listener
  useEffect(() => {
    enumerateDevices();

    // Listen for device changes (plug/unplug)
    const handleDeviceChange = () => {
      console.log('[useDeviceSelection] Device change detected');
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  /**
   * Switch to a different video device
   * Returns constraints for creating a new video track
   */
  const switchVideoDevice = useCallback((deviceId) => {
    setSelectedVideoDevice(deviceId);
    return {
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
  }, []);

  /**
   * Switch to a different audio device
   * Returns constraints for creating a new audio track
   */
  const switchAudioDevice = useCallback((deviceId) => {
    setSelectedAudioDevice(deviceId);
    return {
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true
      }
    };
  }, []);

  /**
   * Get constraints for both video and audio with selected devices
   */
  const getMediaConstraints = useCallback(() => {
    const constraints = {
      video: selectedVideoDevice
        ? { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: selectedAudioDevice
        ? { deviceId: { exact: selectedAudioDevice }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true }
    };
    return constraints;
  }, [selectedVideoDevice, selectedAudioDevice]);

  /**
   * Request permission and re-enumerate devices
   * Call this after first getUserMedia succeeds
   */
  const refreshDevices = useCallback(async () => {
    await enumerateDevices();
  }, [enumerateDevices]);

  /**
   * Get a readable label for a device
   */
  const getDeviceLabel = useCallback((device, index, type) => {
    if (device.label) return device.label;
    return `${type === 'video' ? 'Camera' : 'Microphone'} ${index + 1}`;
  }, []);

  return {
    // Device lists
    videoDevices,
    audioDevices,

    // Selected device IDs
    selectedVideoDevice,
    selectedAudioDevice,

    // Setters for direct selection
    setSelectedVideoDevice,
    setSelectedAudioDevice,

    // Functions to switch devices (returns constraints)
    switchVideoDevice,
    switchAudioDevice,

    // Utility functions
    getMediaConstraints,
    refreshDevices,
    getDeviceLabel,

    // State
    hasPermission
  };
}
