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
}

export interface BrowserInfo {
  isChrome: boolean;
  isEdge: boolean;
  isWindows: boolean;
  supportsSystemAudio: boolean;
  version: string;
}

export interface CaptureError {
  type: 'permission-denied' | 'no-audio-track' | 'browser-unsupported' | 'unknown';
  message: string;
  userAction?: string;
}