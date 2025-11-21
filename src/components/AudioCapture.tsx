import React, { useState } from 'react';
import { Play, Square, Download, Trash2, Info } from 'lucide-react';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { AudioVisualizer } from './AudioVisualizer';
import { SubtitleOverlay } from './SubtitleOverlay';
import type { CaptureMode } from '../types/audio.types';

export const AudioCapture: React.FC = () => {
  const { state: captureState, startCapture, stopCapture, getAnalyserNode } = useAudioCapture();
  const analyserNode = getAnalyserNode();
  const analysisData = useAudioAnalysis(analyserNode);
  const [mode, setMode] = useState<CaptureMode>('system');
  const [subtitles, setSubtitles] = useState<string[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlaySize, setOverlaySize] = useState(22);

  // Recording and live transcription helpers
  const {
    state: recordingState,
    startRecording,
    stopRecording,
    clearRecording,
    downloadRecording,
    formatTime,
    formatFileSize,
    estimatedFileSize,
    startLiveSubtitles,
    stopLiveSubtitles,
    liveSubtitlesEnabled,
  } = useAudioRecording(captureState.stream, {
    streamToServer: false,
    segmentDurationSec: 5,
    onTranscription: (r) => {
      const t = (r?.text || '').replace(/\s+/g, ' ').trim();
      if (!t) return;
      setSubtitles((prev) => {
        const last = prev[prev.length - 1] || '';
        if (t === last) return prev;
        const merged = [...prev, t].slice(-200);
        return merged;
      });
    },
  });

  const handleStartCapture = async () => {
    await startCapture(mode);
  };

  const handleStopCapture = () => {
    stopCapture();
    if (recordingState.isRecording) {
      stopRecording();
    }
  };

  const handleStartRecording = async () => {
    if (!captureState.isCapturing) return;
    if (!captureState.hasAudioTrack) return; // guard when audio not shared
    await startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleClearRecording = () => {
    clearRecording();
    setSubtitles([]);
  };

  const handleDownloadRecording = () => {
    downloadRecording();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Audio Capture</h1>
            <p className="text-gray-400 text-sm mt-1">
              {mode === 'system'
                ? 'Capture system audio (Windows + Chrome/Edge)'
                : 'Capture a browser tab’s audio (Chrome/Edge on Windows or macOS)'}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                captureState.isCapturing ? 'bg-green-500 animate-pulse' : 'bg-gray-600'
              }`}
            />
            <span className="text-sm text-gray-300">
              {captureState.isCapturing ? 'Capturing' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => setMode('system')}
            className={`px-3 py-2 rounded border ${mode === 'system' ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-700 text-gray-200 border-gray-600'}`}
          >
            System Audio (Windows)
          </button>
          <button
            onClick={() => setMode('tab')}
            className={`px-3 py-2 rounded border ${mode === 'tab' ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-700 text-gray-200 border-gray-600'}`}
          >
            Browser Tab Audio (Win/macOS)
          </button>

          <div className="flex items-center space-x-2 ml-auto">
            <span className="text-sm text-gray-300">Live TTS chunks upload as WAV (16 kHz mono)</span>
          </div>
        </div>

        {captureState.error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <div className="text-red-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-red-200 font-medium">Capture Error</p>
                <p className="text-red-300 text-sm">{captureState.error}</p>
              </div>
            </div>
          </div>
        )}

        {recordingState.error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <div className="text-red-400">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <p className="text-red-200 font-medium">Recording Error</p>
                <p className="text-red-300 text-sm">{recordingState.error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          {!captureState.isCapturing ? (
            <button
              onClick={handleStartCapture}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Start Capture</span>
            </button>
          ) : (
            <button
              onClick={handleStopCapture}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Square className="w-4 h-4" />
              <span>Stop Capture</span>
            </button>
          )}

          {captureState.isCapturing && (
            <>
              {!recordingState.isRecording ? (
                <button
                  onClick={handleStartRecording}
                  disabled={!captureState.hasAudioTrack}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Start Recording</span>
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop Recording</span>
                </button>
              )}

              {!liveSubtitlesEnabled ? (
                <button
                  onClick={startLiveSubtitles}
                  disabled={!captureState.hasAudioTrack}
                  className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Enable Live TTS</span>
                </button>
              ) : (
                <button
                  onClick={stopLiveSubtitles}
                  className="flex items-center space-x-2 bg-purple-800 hover:bg-purple-900 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Square className="w-4 h-4" />
                  <span>Disable Live TTS</span>
                </button>
              )}

              {!captureState.hasAudioTrack && (
                <div className="text-xs text-yellow-200 bg-yellow-900 border border-yellow-700 rounded px-2 py-1">
                  Enable "Share audio" in the picker to record.
                </div>
              )}
            </>
          )}
        </div>

        {recordingState.isRecording && (
          <div className="bg-green-900 border border-green-700 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-green-200 font-medium">Recording</span>
              </div>
              <div className="text-green-300 font-mono text-lg">
                {formatTime(recordingState.recordingTime)}
              </div>
            </div>
            <div className="text-xs text-green-200 mt-2">
              Est. size at current bitrate: {estimatedFileSize(recordingState.recordingTime, recordingState.activeBitRate ?? 128000)}
            </div>
          </div>
        )}

        {recordingState.downloadUrl && (
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 font-medium">Recording Complete</p>
                <p className="text-blue-300 text-sm">
                  Size: {formatFileSize(recordingState.fileSize)} | Duration: {formatTime(recordingState.recordingTime)}
                </p>
                <p className="text-blue-300 text-xs">
                  Type: {recordingState.downloadMimeType || 'unknown'} | File: .{recordingState.fileExtension || 'webm'}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleDownloadRecording}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
                <button
                  onClick={handleClearRecording}
                  className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {subtitles.length > 0 && (
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-medium">Live Transcript</p>
              <button
                onClick={() => setSubtitles([])}
                className="text-sm bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded"
              >
                Clear
              </button>
            </div>
            <div className="text-gray-200 text-sm space-y-2 max-h-48 overflow-auto">
              {subtitles.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={(e) => setShowOverlay(e.target.checked)}
            />
            Show Subtitles Overlay
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-200">
            Size
            <input
              type="range"
              min={16}
              max={36}
              value={overlaySize}
              onChange={(e) => setOverlaySize(parseInt(e.target.value, 10))}
            />
          </label>
        </div>
      </div>

      {captureState.isCapturing && (
        <AudioVisualizer
          frequencyData={analysisData.frequencyData}
          waveformData={analysisData.waveformData}
          audioLevel={analysisData.audioLevel}
          isActive={captureState.hasAudioTrack}
        />
      )}

      <SubtitleOverlay
        lines={subtitles}
        visible={showOverlay}
        fontSizePx={overlaySize}
        opacity={0.9}
        position="bottom"
        maxLines={3}
      />

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Instructions</h2>
        {mode === 'system' ? (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>1. Click "Start Capture"</p>
            <p>2. Select your Entire Screen when prompted</p>
            <p>3. Check "Share audio" in the dialog</p>
            <p>4. Click "Start Recording" to save audio</p>
            <p>5. Click "Stop Recording" to finish and download</p>
            <p>6. Optional: Click "Enable Live TTS" to stream text from the local Whisper server.</p>
          </div>
        ) : (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>1. Click "Start Capture"</p>
            <p>2. Choose the Teams browser tab in the picker</p>
            <p>3. Check "Share audio" for the tab</p>
            <p>4. Click "Start Recording" to save audio</p>
            <p>5. Click "Stop Recording" to finish and download</p>
            <p>6. Optional: Click "Enable Live TTS" to stream text from the local Whisper server.</p>
          </div>
        )}
        
        <div className="mt-4 p-3 bg-purple-900 border border-purple-700 rounded">
          <p className="text-purple-100 text-sm">
            Live TTS sends small WAV chunks (5 seconds) to <code>http://localhost:5005/transcribe</code>. Keep the Whisper server running to see subtitles update in real time.
          </p>
        </div>
        
        <div className="mt-4 p-3 bg-yellow-900 border border-yellow-700 rounded">
          <p className="text-yellow-200 text-sm">
            <strong>Note:</strong> System audio works only on Windows (Chrome/Edge). Tab audio works on Windows and macOS in Chrome/Edge.
          </p>
        </div>
      </div>
    </div>
  );
};
