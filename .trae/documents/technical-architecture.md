# Technical Architecture Document

## 1. Project Overview

This prototype demonstrates the technical feasibility of capturing Windows system audio output through web browser APIs for enterprise evaluation purposes. The primary goal is to evaluate the possibility of building an internal tool that can capture and process audio from Teams video calls for real-time translation.

**Key Objectives:**
- Capture system-wide audio from Windows desktop
- Provide real-time audio visualization
- Save audio data for analysis
- Validate browser-based audio capture limitations
- Test Chrome/Edge compatibility on Windows

**Target Environment:** Windows 10/11 with Chrome/Edge browsers only

## 2. Technical Approach

### 2.1 Audio Capture Strategy

Based on research findings, the implementation will use the `getDisplayMedia()` API with specific constraints:

```typescript
const displayMediaOptions = {
  video: true, // Required - cannot do audio-only
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  },
  systemAudio: "include" as const, // Experimental hint for system audio
  monitorTypeSurfaces: "include" as const // Allow screen capture
};
```

**Critical Implementation Details:**
- User must select "Share Audio" checkbox when prompted
- Must capture entire screen (not specific windows) for system audio
- Audio track is optional and may not be provided even when requested
- Cannot capture specific application audio only

### 2.2 Browser Compatibility Matrix

| Browser | Windows System Audio | Notes |
|---------|---------------------|---------|
| Chrome 74+ | ✅ Supported | Full system audio capture when sharing screen |
| Edge 79+ | ✅ Supported | Chromium-based Edge only |
| Firefox | ❌ Not Supported | No audio capture implementation |
| Safari | ❌ Not Supported | No system audio support |

## 3. Audio Visualization Strategy

### 3.1 Real-time Audio Analysis

Using Web Audio API for frequency analysis and waveform generation:

```typescript
// Audio context setup
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;

// Connect media stream to analyser
const source = audioContext.createMediaStreamSource(stream);
source.connect(analyser);

// Frequency data extraction
const frequencyData = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(frequencyData);
```

### 3.2 Visualization Components

**Frequency Bars:**
- Real-time frequency spectrum (32-44kHz range)
- 64-128 frequency bands
- Responsive bar chart using Canvas API

**Waveform Display:**
- Time-domain waveform visualization
- 2048 sample buffer for smooth display
- Amplitude scaling for visibility

## 4. Data Saving Approach

### 4.1 Audio Recording Strategy

**MediaRecorder Configuration:**
```typescript
const recorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000
});
```

**Data Collection:**
- Record audio chunks during capture session
- Store in memory as Blob array
- Convert to downloadable format on demand
- Provide download link for analysis

### 4.2 File Format Options

**Primary:** WebM with Opus codec (best compression)
**Fallback:** WAV format (uncompressed, larger files)
**Chunk Size:** 1-second intervals for real-time processing

## 5. Implementation Architecture

### 5.1 Component Structure

```
src/
├── components/
│   ├── AudioCapture.tsx      // Main capture interface
│   ├── AudioVisualizer.tsx   // Real-time visualization
│   ├── RecordingControls.tsx // Start/stop/save controls
│   └── StatusIndicator.tsx   // Connection status
├── hooks/
│   ├── useAudioCapture.ts    // Core capture logic
│   ├── useAudioAnalysis.ts   // Web Audio API integration
│   └── useRecording.ts       // MediaRecorder management
├── utils/
│   ├── audioHelpers.ts       // Audio processing utilities
│   └── browserDetection.ts  // Browser capability checks
└── types/
    └── audio.types.ts        // TypeScript interfaces
```

### 5.2 State Management

**React Context for Audio State:**
```typescript
interface AudioCaptureState {
  isCapturing: boolean;
  hasAudioTrack: boolean;
  audioLevel: number;
  recordingStatus: 'idle' | 'recording' | 'paused';
  error: string | null;
}
```

## 6. Limitations and Workarounds

### 6.1 Teams Audio Capture Limitations

**Problem:** Cannot capture audio from specific applications (like Teams) only
**Solution:** User must share entire screen while Teams is active
**Impact:** Captures all system audio, not just Teams

### 6.2 Browser Security Requirements

**User Interaction Required:**
- Must trigger capture from user gesture (click/touch)
- Browser will show permission prompt
- User must explicitly check "Share audio" option
- Cannot programmatically select audio source

### 6.3 Audio Track Availability

**Conditional Support:**
- Audio track may not be provided even when requested
- Must check `stream.getAudioTracks().length > 0`
- Fallback to visual-only capture if audio unavailable
- Provide clear user feedback about audio status

## 7. Technical Dependencies

### 7.1 Core Technologies

- **React 18** with TypeScript 5.x
- **Vite** for build tooling
- **Web Audio API** for analysis
- **MediaRecorder API** for recording
- **Canvas API** for visualization

### 7.2 Browser APIs Required

- `navigator.mediaDevices.getDisplayMedia()`
- `AudioContext` and `AnalyserNode`
- `MediaRecorder` with WebM support
- Canvas 2D context for rendering

## 8. Testing Strategy

### 8.1 Audio Capture Validation

**Test Scenarios:**
1. System audio capture during Teams call
2. Audio level detection and visualization
3. Recording quality and file integrity
4. Browser permission handling
5. Error recovery and user feedback

### 8.2 Performance Considerations

**Monitoring Points:**
- CPU usage during capture and analysis
- Memory usage with audio buffers
- Browser tab performance impact
- Audio latency and synchronization

## 9. Future Considerations

### 9.1 Translation Integration

**Next Phase Requirements:**
- Real-time audio streaming to translation service
- WebSocket connection for continuous processing
- Buffer management for low-latency translation
- Multi-language support architecture

### 9.2 Enterprise Deployment

**Potential Enhancements:**
- Group Policy configuration for browser permissions
- Silent installation and configuration
- Integration with enterprise authentication
- Centralized logging and monitoring