import { useState, useCallback, useRef } from 'react';
import { AudioCaptureState, DisplayMediaOptions, CaptureError } from '../types/audio.types';
import type { CaptureMode } from '../types/audio.types';

export const useAudioCapture = () => {
  const [state, setState] = useState<AudioCaptureState>({
    isCapturing: false,
    hasAudioTrack: false,
    audioLevel: 0,
    recordingStatus: 'idle',
    error: null,
    stream: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioLevelIntervalRef = useRef<number | null>(null);

  const startCapture = useCallback(async (mode: CaptureMode = 'system') => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const options: DisplayMediaOptions =
        mode === 'system'
          ? {
              video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 },
              },
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 48000,
                channelCount: 2,
              },
              systemAudio: 'include',
              monitorTypeSurfaces: 'include',
            }
          : {
              video: {
                frameRate: { ideal: 30 },
              },
              audio: true,
            };

      const stream = await navigator.mediaDevices.getDisplayMedia(options);

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        const error: CaptureError = {
          type: 'no-audio-track',
          message:
            mode === 'system'
              ? 'No audio track captured. Ensure "Share audio" is enabled when selecting the screen.'
              : 'No audio track captured. Select the Teams browser tab and enable "Share audio".',
          userAction:
            mode === 'system'
              ? 'Select "Share audio" when prompted and share Entire Screen.'
              : 'Pick the Teams tab (Chrome/Edge) in the picker and tick "Share audio".',
        };
        setState(prev => ({ ...prev, error: error.message }));
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const updateAudioLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = Math.min(100, (average / 255) * 100);

        setState(prev => ({ ...prev, audioLevel: normalizedLevel }));
      };

      audioLevelIntervalRef.current = window.setInterval(updateAudioLevel, 100);

      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          stopCapture();
        });
      });

      setState({
        isCapturing: true,
        hasAudioTrack: true,
        audioLevel: 0,
        recordingStatus: 'idle',
        error: null,
        stream,
      });
    } catch (error) {
      let captureError: CaptureError;

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          captureError = {
            type: 'permission-denied',
            message: 'Permission denied. Please allow screen sharing with audio.',
            userAction: 'Please allow screen sharing when prompted by your browser.',
          };
        } else if (error.name === 'NotSupportedError') {
          captureError = {
            type: 'browser-unsupported',
            message:
              mode === 'system'
                ? 'Your browser does not support system audio capture.'
                : 'Your browser does not support tab audio capture.',
            userAction:
              mode === 'system'
                ? 'Use Chrome or Edge on Windows.'
                : 'Use Chrome or Edge and select the Teams tab in the picker.',
          };
        } else {
          captureError = { type: 'unknown', message: `Failed to capture audio: ${error.message}` };
        }
      } else {
        captureError = { type: 'unknown', message: 'Failed to capture audio: Unknown error occurred' };
      }

      setState(prev => ({ ...prev, error: captureError.message }));
      console.error('Audio capture error:', error);
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
    }

    setState({
      isCapturing: false,
      hasAudioTrack: false,
      audioLevel: 0,
      recordingStatus: 'idle',
      error: null,
      stream: null,
    });
  }, [state.stream]);

  const getAnalyserNode = useCallback(() => {
    return analyserRef.current;
  }, []);

  return {
    state,
    startCapture,
    stopCapture,
    getAnalyserNode,
  };
};