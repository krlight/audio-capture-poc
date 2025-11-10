import { useState, useCallback, useRef } from 'react';
import { AudioRecorderState, RecordingOptions } from '../types/audio.types';

export const useAudioRecording = (audioStream: MediaStream | null) => {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    recordingTime: 0,
    chunks: [],
    downloadUrl: null,
    fileSize: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    if (!audioStream) {
      console.error('No audio stream available for recording');
      return;
    }

    try {
      const audioTrack = audioStream.getAudioTracks()[0];
      if (!audioTrack) {
        console.error('No audio track in stream');
        return;
      }

      const audioStreamOnly = new MediaStream([audioTrack]);

      const options: RecordingOptions = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000,
      };

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn('Preferred mime type not supported, trying fallback');
        options.mimeType = 'audio/webm';
      }

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn('WebM not supported, trying WAV');
        options.mimeType = 'audio/wav';
      }

      const mediaRecorder = new MediaRecorder(audioStreamOnly, options);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          setState(prev => ({
            ...prev,
            chunks: [...chunks],
            fileSize: chunks.reduce((total, chunk) => total + chunk.size, 0),
          }));
        }
      };

      mediaRecorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: options.mimeType });
          const downloadUrl = URL.createObjectURL(blob);
          
          setState(prev => ({
            ...prev,
            downloadUrl,
            fileSize: blob.size,
          }));
        }

        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        stopRecording();
      };

      startTimeRef.current = Date.now();
      
      timerIntervalRef.current = window.setInterval(() => {
        setState(prev => ({
          ...prev,
          recordingTime: Date.now() - startTimeRef.current,
        }));
      }, 100);

      mediaRecorder.start(1000);

      setState(prev => ({
        ...prev,
        isRecording: true,
        recordingTime: 0,
        chunks: [],
        downloadUrl: null,
        fileSize: 0,
      }));

    } catch (error) {
      console.error('Failed to start recording:', error);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [audioStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isRecording: false,
    }));
  }, [state.isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      } else if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
    }
  }, [state.isRecording]);

  const clearRecording = useCallback(() => {
    if (state.downloadUrl) {
      URL.revokeObjectURL(state.downloadUrl);
    }

    setState({
      isRecording: false,
      recordingTime: 0,
      chunks: [],
      downloadUrl: null,
      fileSize: 0,
    });
  }, [state.downloadUrl]);

  const downloadRecording = useCallback(() => {
    if (!state.downloadUrl) return;

    const link = document.createElement('a');
    link.href = state.downloadUrl;
    link.download = `audio-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [state.downloadUrl]);

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((milliseconds % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    clearRecording,
    downloadRecording,
    formatTime,
    formatFileSize,
  };
};