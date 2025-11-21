## Overview
- Start the Whisper Flask server and the Vite React client concurrently.
- Configure the client to point at the local Whisper API.
- Validate end-to-end: capture tab/system audio, stream segments to backend, display live transcript.

## Prerequisites
- Python 3.10+ and Node.js 18+ available.
- ffmpeg installed (`brew install ffmpeg`) for Whisper audio handling.
- Ports: `5005` for the server, Vite defaults to `5173` for the client.

## Whisper Server
- Navigate to `whisper_server/`.
- Create/activate venv: `python3 -m venv .venv && source .venv/bin/activate`.
- Install deps: `pip install -r requirements.txt`.
- Optional env:
  - `WHISPER_MODEL_SIZE=small.en` (default)
  - `MAX_UPLOAD_MB=20`
  - `PORT=5005`
- Launch: `python app.py`.
- Verify: `curl http://localhost:5005/health` → `{"status":"ok"}`.
- Note: First transcription triggers model download; expect a delay.

## Client Configuration
- Create `./.env.local` in the project root with `VITE_WHISPER_BASE_URL=http://localhost:5005`.
- Install deps: `npm install`.

## Client Dev Server
- Start: `npm run dev`.
- Open the shown URL (e.g., `http://localhost:5173/`).
- Choose capture mode:
  - Windows: “System Audio (Windows)” or “Browser Tab Audio”.
  - macOS: “Browser Tab Audio”.
- Click “Start Capture” → pick screen/tab and enable “Share audio”.
- Click “Start Recording” → segments (5s, 1s overlap) upload to `/transcribe`.
- Watch Live Transcript panel populate as responses arrive.

## Validation
- Network tab shows periodic `POST /transcribe` calls; responses include `text`, `segments`, `duration`.
- UI Live Transcript updates within a few seconds per segment.
- Stop recording → final buffered segment uploads and transcript appends.

## Troubleshooting
- CORS errors: ensure the Flask server is running; it has CORS enabled.
- 413 errors: increase `MAX_UPLOAD_MB` if segments exceed limit.
- ffmpeg missing: install `brew install ffmpeg`.
- Model size/delay: adjust `WHISPER_MODEL_SIZE` (e.g., `tiny.en` for faster startup).

## Optional Enhancements
- Expose segment duration in UI and allow tuning overlap.
- Smooth subtitles with punctuation merging and dedup across overlaps.
- Persist transcripts and timestamps for later export.

## Next Step
- With your confirmation, I will execute the commands to start both servers, set env, and open the preview, verifying the live transcript end-to-end.