import argparse
import json
import sys
from pathlib import Path

from app import transcribe_audio_file


def run_cli(audio_path: Path, as_json: bool = False) -> int:
    if not audio_path.exists():
        print(f"File not found: {audio_path}", file=sys.stderr)
        return 1
    payload = transcribe_audio_file(str(audio_path))
    if as_json:
        print(json.dumps(payload, indent=2))
    else:
        print(payload["text"] or "")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Transcribe an audio file using the local Whisper model."
    )
    parser.add_argument("audio", type=Path, help="Path to the audio file")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the full JSON payload instead of just the transcript",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raise SystemExit(run_cli(args.audio, args.json))


if __name__ == "__main__":
    main()
