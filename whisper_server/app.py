import os
import tempfile
from pathlib import Path
from typing import Dict, Optional

from flask import Flask, jsonify, request

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

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

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
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    uploaded_file.save(tmp.name)
    tmp.close()
    return tmp.name


@app.errorhandler(413)
def file_too_large(_: Exception):
    return jsonify({"error": f"File exceeds {MAX_UPLOAD_MB}MB limit"}), 413


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
    try:
        temp_path = _save_upload_to_tempfile(file)
        payload = transcribe_audio_file(temp_path)
        return jsonify(payload)
    except Exception as exc:  # pragma: no cover - prototype level logging
        return jsonify({"error": str(exc)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5005")))
