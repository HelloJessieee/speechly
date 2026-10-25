"""English target IPA via local eSpeak NG, matching the CTC model convention."""
from __future__ import annotations

import re


def phonemes_for_short_phrase(text: str) -> list[str]:
    words = [word.strip(".,!?;:") for word in text.split()]
    if not 1 <= len(words) <= 10 or any(not re.fullmatch(r"[A-Za-z]+(?:'[A-Za-z]+)?", word) for word in words):
        return []
    try:
        from phonemizer import phonemize
        from phonemizer.separator import Separator

        output = phonemize(" ".join(words), language="en-us", backend="espeak", separator=Separator(phone=" ", word="|"), strip=True, with_stress=False)
        tokens = [part for part in output.replace("|", " ").split() if part]
        return tokens if 1 <= len(tokens) <= 30 else []
    except (ImportError, RuntimeError, OSError):
        return []


def phonemes_for_single_word(text: str) -> list[str]:
    words = text.strip().split()
    if len(words) != 1:
        return []
    tokens = phonemes_for_short_phrase(text)
    return tokens if len(tokens) <= 15 else []
