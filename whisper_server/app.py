import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Optional
from uuid import uuid4

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    import whisper
except ImportError as exc:
    raise RuntimeError(
        "openai-whisper is required. Install dependencies inside the virtualenv "
        "before running the server."
    ) from exc


DEFAULT_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small.en")
MODEL_CACHE = Path(os.environ.get("WHISPER_MODEL_DIR", Path.cwd() / "models"))
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "10"))
UPLOAD_DIR = Path(os.environ.get("WHISPER_UPLOAD_DIR", Path(__file__).parent / ".temp"))

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
app.logger.setLevel(logging.INFO)

_model: Optional["whisper.Whisper"] = None


def get_model() -> "whisper.Whisper":
    """
    Lazily load the Whisper model the first time we need it so the server
    can start quickly and only download weights when necessary.
    """
    global _model
    if _model is None:
        MODEL_CACHE.mkdir(parents=True, exist_ok=True)
        _model = whisper.load_model(
            DEFAULT_MODEL_SIZE, device="cpu", download_root=str(MODEL_CACHE)
        )
    return _model


@app.get("/health")
def health() -> tuple[dict[str, str], int]:
    return {"status": "ok"}, 200


def _save_upload_to_tempfile(uploaded_file) -> str:
    suffix = Path(uploaded_file.filename or "").suffix
    if not suffix:
        suffix = ".bin"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = UPLOAD_DIR / f"{uuid4().hex}{suffix}"
    uploaded_file.save(temp_path)
    return str(temp_path)


@app.errorhandler(413)
def file_too_large(_: Exception):
    return jsonify({"error": f"File exceeds {MAX_UPLOAD_MB}MB limit"}), 413


def _convert_to_wav(input_path: str) -> str:
    """
    Convert input audio to 16 kHz mono WAV using ffmpeg for reliable decoding,
    especially for short WebM/Opus segments.
    """
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    out = tempfile.NamedTemporaryFile(delete=False, suffix=".wav", dir=str(UPLOAD_DIR))
    out_path = out.name
    out.close()
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        input_path,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        out_path,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        try:
            os.remove(out_path)
        except Exception:
            pass
        msg = proc.stderr.decode(errors="ignore")
        app.logger.error(
            "ffmpeg failed while converting %s -> %s. stderr=%s",
            input_path,
            out_path,
            msg,
        )
        raise RuntimeError(f"Failed to convert audio: {msg[:400]}")
    return out_path


def transcribe_audio_file(file_path: str) -> Dict[str, object]:
    """
    Shared transcription helper that powers both the web API and the CLI.
    """
    model = get_model()
    result = model.transcribe(
        file_path, language="en", task="transcribe", verbose=False
    )
    text = (result.get("text") or "").strip()
    segment_payload = [
        {
            "start": segment.get("start"),
            "end": segment.get("end"),
            "text": segment.get("text", ""),
        }
        for segment in result.get("segments", [])
    ]
    return {
        "text": text,
        "detected_language": result.get("language"),
        "duration": result.get("duration"),
        "segments": segment_payload,
    }


@app.post("/transcribe")
def transcribe():
    file = request.files.get("file") or request.files.get("audio")
    if file is None:
        return jsonify({"error": "Upload an audio file using the 'file' field"}), 400
    if not file.filename:
        return jsonify({"error": "Uploaded file must have a filename"}), 400

    temp_path = None
    converted_path = None
    try:
        temp_path = _save_upload_to_tempfile(file)
        mimetype = getattr(file, "mimetype", "") or ""
        suffix = Path(temp_path).suffix.lower()
        file_size = os.path.getsize(temp_path)
        app.logger.info(
            "/transcribe received file=%s mime=%s suffix=%s size=%dB",
            file.filename,
            mimetype,
            suffix,
            file_size,
        )

        # Normalize WebM segments to WAV PCM for robust decoding
        if "webm" in mimetype or suffix == ".webm":
            print("Using ffmpeg to convert WebM to WAV")
            converted_path = _convert_to_wav(temp_path)
            path_for_model = converted_path
        else:
            path_for_model = temp_path

        payload = transcribe_audio_file(path_for_model)
        return jsonify(payload)
    except Exception as exc:  # pragma: no cover - prototype level logging
        app.logger.exception("/transcribe error: %s", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        # Keep uploaded files in UPLOAD_DIR for inspection/troubleshooting.
        pass


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5005")))
