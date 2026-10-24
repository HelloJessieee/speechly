"""Command-line entry point."""
import argparse
import json
from pathlib import Path

from .pipeline import analyze
from .targets import EXERCISES


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze local PCM WAV offline")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--exercise", choices=EXERCISES, default="vowel_u_sustain")
    parser.add_argument("--target-duration", type=float)
    parser.add_argument("--phonemes", action="store_true")
    parser.add_argument("--gemma", action="store_true", help="Use local Gemma coaching")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    result = analyze(Path(args.audio).read_bytes(), args.exercise, args.target_duration, args.phonemes, use_gemma=args.gemma)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
