"""English target IPA via local eSpeak NG, matching the CTC model convention."""
from __future__ import annotations

import re


def phonemes_for_single_word(text: str) -> list[str]:
    word = text.strip().rstrip(".,!?;:")
    if not re.fullmatch(r"[A-Za-z]+(?:'[A-Za-z]+)?", word):
        return []
    try:
        from phonemizer import phonemize
        from phonemizer.separator import Separator

        output = phonemize(word, language="en-us", backend="espeak", separator=Separator(phone=" ", word="|"), strip=True, with_stress=False)
        tokens = [part for part in output.replace("|", " ").split() if part]
        return tokens if 1 <= len(tokens) <= 15 else []
    except (ImportError, RuntimeError, OSError):
        return []
