import { useCallback, useRef, useState } from 'react';
import type { RecordingFormat, RecordingFormatInfo } from '../types/audio.types';
import { transcribeBlob, type TranscriptionResponse } from '../services/transcription';
import { ensureWavBlob } from '../utils/audioProcessing';

export interface AudioRecorderState {
  isRecording: boolean;
  recordingTime: number;
  fileSize: number;
  downloadUrl: string | null;
  error: string | null;
  downloadMimeType?: string | null;
  fileExtension?: string | null;
  activeBitRate?: number | null;
  activeMimeType?: string | null;
}

// Formats: MP3 (when available), M4A (AAC), WebM (Opus/generic)
const AVAILABLE_FORMATS: RecordingFormatInfo[] = [
  {
    format: 'mp3',
    label: 'MP3 (.mp3)',
    description: 'Common format. Recording support varies by browser.',
    preferredMimeTypes: ['audio/mpeg'],
    extension: 'mp3',
    defaultBitRate: 128_000,
  },
  {
    format: 'mp4_aac',
    label: 'MP4 (AAC, .m4a)',
    description: 'Preferred when supported. Widely compatible playback.',
    preferredMimeTypes: ['audio/mp4; codecs=aac', 'audio/mp4'],
    extension: 'm4a',
    defaultBitRate: 128_000,
  },
  {
    format: 'webm_opus',
    label: 'WebM (Opus)',
    description: 'High quality, small size. Excellent on Chrome/Edge.',
    preferredMimeTypes: ['audio/webm;codecs=opus', 'audio/webm'],
    extension: 'webm',
    defaultBitRate: 128_000,
  },
  {
    format: 'webm',
    label: 'WebM (Generic)',
    description: 'Fallback WebM when Opus is not reported available.',
    preferredMimeTypes: ['audio/webm'],
    extension: 'webm',
    defaultBitRate: 96_000,
  },
];

function isTypeSupported(mime: string): boolean {
  try {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime);
  } catch {
    return false;
  }
}

export function getSupportedFormats(): RecordingFormatInfo[] {
  const results = AVAILABLE_FORMATS.map((f) => ({
    ...f,
    preferredMimeTypes: f.preferredMimeTypes.filter(isTypeSupported),
  }));
  return results.filter((f) => f.preferredMimeTypes.length > 0);
}

export function getBestMimeTypeForFormat(format: RecordingFormat): string | null {
  const info = AVAILABLE_FORMATS.find((f) => f.format === format);
  if (!info) return null;
  const supported = info.preferredMimeTypes.find(isTypeSupported);
  return supported || null;
}

export function getFormatInfo(format: RecordingFormat): RecordingFormatInfo | undefined {
  return AVAILABLE_FORMATS.find((f) => f.format === format);
}

export function useAudioRecording(
  stream?: MediaStream | null,
  opts?: { streamToServer?: boolean; segmentDurationSec?: number; onTranscription?: (r: TranscriptionResponse) => void }
) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const segmentChunksRef = useRef<Blob[]>([]);
  const segmentElapsedMsRef = useRef<number>(0);
  const liveRecorderRef = useRef<MediaRecorder | null>(null);
  const liveLoopActiveRef = useRef<boolean>(false);
  const [liveSubtitlesEnabled, setLiveSubtitlesEnabled] = useState<boolean>(false);
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    recordingTime: 0,
    fileSize: 0,
    downloadUrl: null,
    error: null,
    downloadMimeType: null,
    fileExtension: null,
    activeBitRate: null,
    activeMimeType: null,
  });

  const sendChunkToTranscription = useCallback(
    async (chunk: Blob) => {
      if (!chunk || chunk.size === 0) return;
      try {
        let payload = chunk;
        if (!chunk.type?.includes('wav')) {
          try {
            payload = await ensureWavBlob(chunk);
          } catch (conversionError) {
            console.warn('Falling back to raw chunk for transcription', conversionError);
            payload = chunk;
          }
        }
        const response = await transcribeBlob(payload);
        if (opts?.onTranscription) opts?.onTranscription(response);
      } catch (e: any) {
        setState((s) => ({ ...s, error: `Upload failed: ${e?.message || String(e)}` }));
      }
    },
    [opts?.onTranscription],
  );

  const startRecording = useCallback(async () => {
    if (!stream) {
      setState((s) => ({ ...s, error: 'No audio stream available to record.' }));
      return;
    }

    try {
      // Build an audio-only stream to ensure audio mime types work
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        setState((s) => ({ ...s, error: 'No audio track present in the capture stream.' }));
        return;
      }
      const audioOnlyStream = new MediaStream([audioTrack]);

      const targetFormat: RecordingFormat = 'webm_opus';
      const formatInfo = getFormatInfo(targetFormat)!;

      const mimeType = getBestMimeTypeForFormat(targetFormat);
      if (!mimeType) {
        setState((s) => ({ ...s, error: 'WebM Opus recording is not supported in this browser.' }));
        return;
      }

      // As a last resort, omit type
      const options: MediaRecorderOptions = { mimeType, audioBitsPerSecond: formatInfo?.defaultBitRate };

      const recorder = new MediaRecorder(audioOnlyStream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      const timesliceMs = 250;
      const segmentTargetMs = Math.max(1000, (opts?.segmentDurationSec || 5) * 1000);
      const overlapMs = 1000;
      const overlapCount = Math.ceil(overlapMs / timesliceMs);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          const chunk = event.data;
          chunksRef.current.push(chunk);
          if (opts?.streamToServer) {
            segmentChunksRef.current.push(chunk);
            segmentElapsedMsRef.current += timesliceMs;
            if (segmentElapsedMsRef.current >= segmentTargetMs) {
              const segBlob = new Blob(segmentChunksRef.current, { type: mimeType || undefined });
              const keep = Math.min(segmentChunksRef.current.length, overlapCount);
              const tail = keep > 0 ? segmentChunksRef.current.slice(-keep) : [];
              segmentChunksRef.current = tail;
              segmentElapsedMsRef.current = keep * timesliceMs;
              void sendChunkToTranscription(segBlob);
            }
          }
        }
      };

      recorder.onerror = (event: Event) => {
        const err = (event as any).error;
        setState((s) => ({ ...s, error: `Recorder error: ${err?.message || 'unknown error'}` }));
        try {
          recorder.stop();
        } catch {}
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || undefined });
        const url = URL.createObjectURL(blob);
        const ext = inferExtensionFromMime(blob.type) || formatInfo?.extension || 'webm';

        setState((s) => ({
          ...s,
          isRecording: false,
          downloadUrl: url,
          fileSize: blob.size,
          downloadMimeType: blob.type || mimeType || null,
          fileExtension: ext,
          activeBitRate: null,
          activeMimeType: null,
        }));

        if (opts?.streamToServer && segmentChunksRef.current.length > 0) {
          const segBlob = new Blob(segmentChunksRef.current, { type: mimeType || undefined });
          segmentChunksRef.current = [];
          segmentElapsedMsRef.current = 0;
          void sendChunkToTranscription(segBlob);
        }
      };

      recorder.start(250);

      setState((s) => ({
        ...s,
        isRecording: true,
        error: null,
        activeBitRate: options.audioBitsPerSecond || null,
        activeMimeType: mimeType || null,
      }));

      // Start timer
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      timerRef.current = window.setInterval(() => {
        setState((s) => ({ ...s, recordingTime: s.recordingTime + 0.25 }));
      }, 250);
    } catch (err: any) {
      setState((s) => ({ ...s, error: `Failed to start recording: ${err?.message || String(err)}` }));
    }
  }, [stream, sendChunkToTranscription]);

  const stopRecording = useCallback(() => {
    try {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (mediaRecorderRef.current && state.isRecording) {
        mediaRecorderRef.current.stop();
      }
    } catch (err: any) {
      setState((s) => ({ ...s, error: `Failed to stop recording: ${err?.message || String(err)}` }));
    }
  }, [state.isRecording]);

  const clearRecording = useCallback(() => {
    try {
      if (state.downloadUrl) {
        URL.revokeObjectURL(state.downloadUrl);
      }
      segmentChunksRef.current = [];
      segmentElapsedMsRef.current = 0;
      setState((s) => ({
        ...s,
        downloadUrl: null,
        fileSize: 0,
        recordingTime: 0,
        downloadMimeType: null,
        fileExtension: null,
        error: null,
        activeBitRate: null,
        activeMimeType: null,
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, error: `Failed to clear recording: ${err?.message || String(err)}` }));
    }
  }, [state.downloadUrl]);

  const downloadRecording = useCallback(() => {
    if (!state.downloadUrl) return;
    const a = document.createElement('a');
    a.href = state.downloadUrl;

    // Use inferred extension if available
    const ext = state.fileExtension || inferExtensionFromMime(state.downloadMimeType || '') || 'webm';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `capture-${timestamp}.${ext}`;
    a.click();
  }, [state.downloadUrl, state.downloadMimeType, state.fileExtension]);

  const formatTime = useCallback((seconds: number) => {
    const s = Math.floor(seconds % 60);
    const m = Math.floor(seconds / 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const estimatedFileSize = useCallback((seconds: number, bitRate = 128_000) => {
    // bitRate in bits/sec -> bytes
    const bytes = (bitRate / 8) * seconds;
    return formatFileSize(bytes);
  }, [formatFileSize]);

  return {
    state,
    startRecording,
    stopRecording,
    clearRecording,
    downloadRecording,
    formatTime,
    formatFileSize,
    estimatedFileSize,
    startLiveSubtitles: useCallback(async () => {
      if (liveSubtitlesEnabled) return;
      if (!stream) {
        setState((s) => ({ ...s, error: 'No audio stream available to start live subtitles.' }));
        return;
      }
      try {
        const fmt = getFormatInfo('webm_opus')!;
        const mime = getBestMimeTypeForFormat('webm_opus');
        if (!mime) {
          setState((s) => ({ ...s, error: 'WebM Opus recording is not supported in this browser.' }));
          return;
        }

        const segmentTargetMs = Math.max(1000, (opts?.segmentDurationSec || 5) * 1000);
        liveLoopActiveRef.current = true;

        const startSegmentRecorder = () => {
          if (!liveLoopActiveRef.current) {
            return;
          }

          const freshTrack = stream.getAudioTracks()[0];
          if (!freshTrack) {
            setState((s) => ({ ...s, error: 'Lost audio track during live subtitles.' }));
            liveLoopActiveRef.current = false;
            setLiveSubtitlesEnabled(false);
            return;
          }

          const audioOnlyStream = new MediaStream([freshTrack]);
          let recorder: MediaRecorder;
          try {
            recorder = new MediaRecorder(audioOnlyStream, {
              mimeType: mime,
              audioBitsPerSecond: fmt.defaultBitRate,
            });
          } catch (segmentErr: any) {
            setState((s) => ({ ...s, error: `Live subtitle recorder failed: ${segmentErr?.message || String(segmentErr)}` }));
            liveLoopActiveRef.current = false;
            setLiveSubtitlesEnabled(false);
            return;
          }

          liveRecorderRef.current = recorder;
          const chunks: Blob[] = [];

          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              chunks.push(ev.data);
            }
          };

          recorder.onerror = (event: Event) => {
            const err = (event as any).error;
            setState((s) => ({ ...s, error: `Recorder error: ${err?.message || 'unknown error'}` }));
          };

          recorder.onstop = () => {
            if (chunks.length > 0) {
              const payload = new Blob(chunks, { type: mime });
              void sendChunkToTranscription(payload);
            }

            if (liveLoopActiveRef.current) {
              startSegmentRecorder();
            }
          };

          recorder.start();
          window.setTimeout(() => {
            if (recorder.state === 'recording') {
              try {
                recorder.stop();
              } catch {}
            }
          }, segmentTargetMs);
        };

        setLiveSubtitlesEnabled(true);
        startSegmentRecorder();
      } catch (err: any) {
        setState((s) => ({ ...s, error: `Failed to start live subtitles: ${err?.message || String(err)}` }));
      }
    }, [stream, liveSubtitlesEnabled, opts?.segmentDurationSec, opts?.onTranscription, sendChunkToTranscription]),

    stopLiveSubtitles: useCallback(() => {
      try {
        liveLoopActiveRef.current = false;
        const recorder = liveRecorderRef.current;
        if (recorder) {
          liveRecorderRef.current = null;
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }
        setLiveSubtitlesEnabled(false);
      } catch (err: any) {
        setState((s) => ({ ...s, error: `Failed to stop live subtitles: ${err?.message || String(err)}` }));
      }
    }, []),

    liveSubtitlesEnabled,
  };
}

function inferExtensionFromMime(mime: string): string | null {
  if (!mime) return null;
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  return null;
}
