"""Local English phonemes for an illustrative, sentence-length lip reference."""
from __future__ import annotations

import re


def sentence_reference(text: str) -> dict:
    text = text.strip().replace("’", "'")
    words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", text)
    if not text or len(text) > 160 or not 1 <= len(words) <= 25:
        raise ValueError("请输入 1–25 个英文单词，最长 160 个字符。")
    if not re.fullmatch(r"[A-Za-z][A-Za-z' ,.?!;:\-]*", text):
        raise ValueError("示范口型目前只支持英文单词与常见标点。")

    from phonemizer import phonemize
    from phonemizer.separator import Separator

    separator = Separator(phone=" ", word="|")
    options = dict(language="en-us", backend="espeak", separator=separator,
                   strip=True, with_stress=False)
    utterance = phonemize(text, **options)
    groups = [part.strip().split() for part in utterance.split("|")]
    if len(groups) != len(words) or any(not group for group in groups):
        individual = phonemize(words, **options)
        groups = [item.replace("|", " ").split() for item in individual]
    if len(groups) != len(words) or any(not group for group in groups):
        raise ValueError("无法为这句话生成逐词音素，请换一句英文。")

    return {"text": text, "words": [
        {"text": word, "phones": phones} for word, phones in zip(words, groups)
    ]}
