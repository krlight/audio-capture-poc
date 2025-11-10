import { useCallback, useMemo, useRef, useState } from 'react';
import type { RecordingFormat, RecordingFormatInfo } from '../types/audio.types';

export interface AudioRecorderState {
  isRecording: boolean;
  recordingTime: number;
  fileSize: number;
  downloadUrl: string | null;
  error: string | null;
  downloadMimeType?: string | null;
  fileExtension?: string | null;
}

// Comprehensive format metadata
const AVAILABLE_FORMATS: RecordingFormatInfo[] = [
  {
    format: 'webm_opus',
    label: 'WebM (Opus)',
    description: 'High quality, small size. Best cross-browser choice.',
    preferredMimeTypes: ['audio/webm;codecs=opus', 'audio/webm'],
    extension: 'webm',
    defaultBitRate: 128_000,
  },
  {
    format: 'wav',
    label: 'WAV (PCM)',
    description: 'Uncompressed. Large size. Good for editing and archiving.',
    preferredMimeTypes: ['audio/wav'],
    extension: 'wav',
    defaultBitRate: 1_411_200, // 16-bit 44.1kHz stereo approx
  },
  {
    format: 'ogg_vorbis',
    label: 'OGG (Vorbis)',
    description: 'Open format. Good quality. Best on Firefox/Linux.',
    preferredMimeTypes: ['audio/ogg; codecs=vorbis', 'audio/ogg'],
    extension: 'ogg',
    defaultBitRate: 128_000,
  },
  {
    format: 'webm',
    label: 'WebM (Generic)',
    description: 'Generic WebM when Opus is not reported available.',
    preferredMimeTypes: ['audio/webm'],
    extension: 'webm',
    defaultBitRate: 96_000,
  },
  {
    format: 'mp4_aac',
    label: 'MP4 (AAC)',
    description: 'Widely compatible container; audio-only support varies by browser.',
    preferredMimeTypes: ['audio/mp4; codecs=aac', 'audio/mp4'],
    extension: 'm4a',
    defaultBitRate: 128_000,
  },
  {
    format: 'mp3',
    label: 'MP3 (MPEG-1 Layer III)',
    description: 'Legacy, broadly supported. Encoding availability varies in browsers.',
    preferredMimeTypes: ['audio/mpeg'],
    extension: 'mp3',
    defaultBitRate: 128_000,
  },
  {
    format: 'flac',
    label: 'FLAC (Lossless)',
    description: 'Lossless compression. Support in MediaRecorder is rare.',
    preferredMimeTypes: ['audio/flac'],
    extension: 'flac',
    defaultBitRate: 700_000, // placeholder estimate
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
  return AVAILABLE_FORMATS.map((f) => ({
    ...f,
    preferredMimeTypes: f.preferredMimeTypes.filter(isTypeSupported),
  }));
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

export function useAudioRecording(stream?: MediaStream | null, desiredFormat?: RecordingFormat) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    recordingTime: 0,
    fileSize: 0,
    downloadUrl: null,
    error: null,
    downloadMimeType: null,
    fileExtension: null,
  });

  const availableFormats = useMemo(() => AVAILABLE_FORMATS, []);

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

      // Choose target format and fallback chain
      const targetFormat = desiredFormat || 'webm_opus';
      const formatInfo = getFormatInfo(targetFormat) || getFormatInfo('webm_opus')!;

      let mimeType = getBestMimeTypeForFormat(targetFormat);
      if (!mimeType) {
        // Progressive fallback across all formats by preference order
        const fallbackCandidates: RecordingFormat[] = [
          'webm_opus', // best quality small size
          'webm',
          'ogg_vorbis',
          'mp4_aac',
          'mp3',
          'wav',
          'flac',
        ];
        for (const f of fallbackCandidates) {
          mimeType = getBestMimeTypeForFormat(f);
          if (mimeType) {
            break;
          }
        }
      }

      // As a last resort, omit type
      const options: MediaRecorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: formatInfo?.defaultBitRate }
        : { audioBitsPerSecond: formatInfo?.defaultBitRate };

      const recorder = new MediaRecorder(audioOnlyStream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
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
        }));
      };

      recorder.start(250); // collect data every 250ms for responsiveness

      setState((s) => ({ ...s, isRecording: true, error: null }));

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
  }, [stream, desiredFormat]);

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
      setState((s) => ({
        ...s,
        downloadUrl: null,
        fileSize: 0,
        recordingTime: 0,
        downloadMimeType: null,
        fileExtension: null,
        error: null,
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
    getSupportedFormats,
    availableFormats,
    estimatedFileSize,
  };
}

function inferExtensionFromMime(mime: string): string | null {
  if (!mime) return null;
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('mp4')) return 'm4a';
  return null;
}