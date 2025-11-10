"""
Utility script to pre-download the configured Whisper model weights.

Usage (honors the same env vars as the server):
  WHISPER_MODEL_SIZE=small.en WHISPER_MODEL_DIR=./models python prepare.py
"""
import os
import sys
from pathlib import Path

try:
    import whisper
except ImportError as exc:
    raise RuntimeError(
        "openai-whisper is required. Install dependencies inside the virtualenv "
        "before running prepare.py."
    ) from exc


DEFAULT_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small.en")
MODEL_CACHE = Path(os.environ.get("WHISPER_MODEL_DIR", Path.cwd() / "models"))


def main() -> int:
    MODEL_CACHE.mkdir(parents=True, exist_ok=True)
    print(
        f"Preparing Whisper model '{DEFAULT_MODEL_SIZE}' in cache {MODEL_CACHE.resolve()}"
    )
    whisper.load_model(
        DEFAULT_MODEL_SIZE,
        device="cpu",
        download_root=str(MODEL_CACHE),
    )
    print("Model download complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
