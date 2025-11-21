export interface AudioCaptureState {
  isCapturing: boolean;
  hasAudioTrack: boolean;
  audioLevel: number;
  recordingStatus: 'idle' | 'recording' | 'paused';
  error: string | null;
  stream: MediaStream | null;
}

export interface DisplayMediaOptions {
  video: boolean | MediaTrackConstraints;
  audio: boolean | MediaTrackConstraints;
  systemAudio?: 'include' | 'exclude';
  monitorTypeSurfaces?: 'include' | 'exclude';
}

export interface AudioAnalysisData {
  frequencyData: Uint8Array;
  waveformData: Uint8Array;
  audioLevel: number;
}

export interface RecordingOptions {
  mimeType: string;
  audioBitsPerSecond: number;
}

export interface AudioRecorderState {
  isRecording: boolean;
  recordingTime: number;
  chunks: Blob[];
  downloadUrl: string | null;
  fileSize: number;
  downloadMimeType?: string;
  fileExtension?: string;
}

export interface BrowserInfo {
  isChrome: boolean;
  isEdge: boolean;
  isWindows: boolean;
  version: string;
  supportsSystemAudio: boolean;
  isMac: boolean;
  supportsTabAudio: boolean;
  browserName?: 'Chrome' | 'Edge' | 'Firefox' | 'Safari' | 'Unknown';
}

export type CaptureMode = 'system' | 'tab';

export type RecordingFormat = 'webm_opus' | 'webm' | 'mp4_aac' | 'mp3';

export interface RecordingFormatInfo {
  format: RecordingFormat;
  label: string;
  description: string;
  preferredMimeTypes: string[];
  extension: string;
  defaultBitRate: number; // bits per second
}

export interface CaptureError {
  type: 'permission-denied' | 'no-audio-track' | 'browser-unsupported' | 'unknown';
  message: string;
  userAction?: string;
}

export interface TranscriptionSegment {
  start?: number;
  end?: number;
  text: string;
}

export interface TranscriptionResponse {
  text: string;
  detected_language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
}
