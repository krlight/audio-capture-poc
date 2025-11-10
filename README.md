# System Audio Capture Prototype

React + Vite proof of concept that captures screen audio (system audio on Windows, or any shared tab) and records it in the browser. While capturing, you can trigger a live "TTS" (speech-to-text) mode that streams short WAV chunks to a local Whisper server for instant subtitles.

## Requirements

- Node.js ≥ 20 (project tested with pnpm but npm/yarn work too)
- Python 3.12 for the Whisper server
- ffmpeg available on the server PATH (only needed when non-WAV uploads arrive)

## Frontend setup

```bash
pnpm install
pnpm dev
# open http://localhost:5173
```

The UI lets you start/stop capture, record to a downloadable WebM file, and toggle **Enable Live TTS**, which streams WAV audio every 5 seconds to `http://localhost:5005/transcribe`.

## Whisper server (Python 3.12)

```bash
cd whisper_server
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py  # listens on port 5005 by default
```

The Flask server lazy-loads `openai-whisper` weights, accepts the WAV chunks coming from the browser, and responds with JSON transcripts that the UI overlays as subtitles. Keep it running whenever you want the Live TTS button to work.

## Notes

- Live TTS uploads now leave the browser as mono 16 kHz WAV chunks, so the server usually skips its ffmpeg shim.
- Downloads still rely on the browser-native MediaRecorder container (WebM/Opus in Chrome) because it's the least brittle format for end users.
- For production deployment make sure the site is served over HTTPS and that screen/audio capture permissions are granted.
