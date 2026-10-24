"""Experimental offline phoneme CTC adapter.

The verified checkpoint emits eSpeak IPA phones. Its top-1 CTC sequence is an
uncalibrated hypothesis; no probability is a pronunciation score.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from time import perf_counter
from threading import Lock
import json

import numpy as np

MODEL = Path(__file__).parents[2] / "models" / "phoneme"
MODEL_LOCK = Lock()


def model_available() -> bool:
    return all((MODEL / name).exists() for name in ("config.json", "vocab.json", "pytorch_model.bin", "preprocessor_config.json"))


@lru_cache(maxsize=1)
def _load():
    import torch
    from transformers import AutoModelForCTC, AutoFeatureExtractor, Wav2Vec2PhonemeCTCTokenizer, Wav2Vec2Processor

    if not model_available():
        raise FileNotFoundError("本地音素模型文件不完整。")
    config = json.loads((MODEL / "tokenizer_config.json").read_text())
    if config.get("tokenizer_class") != "Wav2Vec2PhonemeCTCTokenizer":
        raise ValueError("模型词表并非已验证的音素输出，已拒绝运行。")
    preprocessor = json.loads((MODEL / "preprocessor_config.json").read_text())
    if preprocessor.get("sampling_rate") != 16000:
        raise ValueError("音素模型需要的采样率不是 16 kHz。")
    # The checkpoint tokenizer defaults to eSpeak text phonemization. Inference
    # only decodes CTC IDs, so disable that backend explicitly and stay offline.
    tokenizer = Wav2Vec2PhonemeCTCTokenizer.from_pretrained(str(MODEL), local_files_only=True, do_phonemize=False)
    feature_extractor = AutoFeatureExtractor.from_pretrained(str(MODEL), local_files_only=True)
    processor = Wav2Vec2Processor(feature_extractor=feature_extractor, tokenizer=tokenizer)
    model = AutoModelForCTC.from_pretrained(str(MODEL), local_files_only=True)
    model.eval()
    if model.config.vocab_size != len(processor.tokenizer.get_vocab()):
        raise ValueError("音素模型和词表大小不一致。")
    return torch, processor, model


def align(target: list[str], predicted: list[str]) -> list[dict]:
    """Levenshtein alignment. Every difference is labelled tentative."""
    rows, cols = len(target) + 1, len(predicted) + 1
    cost = [[0] * cols for _ in range(rows)]
    for i in range(rows): cost[i][0] = i
    for j in range(cols): cost[0][j] = j
    for i in range(1, rows):
        for j in range(1, cols):
            cost[i][j] = min(cost[i-1][j]+1, cost[i][j-1]+1, cost[i-1][j-1]+(target[i-1]!=predicted[j-1]))
    differences = []
    i, j = len(target), len(predicted)
    while i or j:
        if i and j and cost[i][j] == cost[i-1][j-1] + (target[i-1] != predicted[j-1]):
            if target[i-1] != predicted[j-1]:
                differences.append({"type":"substitution","expected":target[i-1],"observed":predicted[j-1],"certainty":"tentative"})
            i -= 1; j -= 1
        elif i and cost[i][j] == cost[i-1][j] + 1:
            differences.append({"type":"deletion","expected":target[i-1],"observed":None,"certainty":"tentative"}); i -= 1
        else:
            differences.append({"type":"insertion","expected":None,"observed":predicted[j-1],"certainty":"tentative"}); j -= 1
    return list(reversed(differences))


def recognize(samples: np.ndarray, target: list[str]) -> tuple[dict, float]:
    started = perf_counter()
    base = {"status":"unavailable","target":target,"predicted":None,"possible_substitutions":[],"confidence":None}
    try:
        with MODEL_LOCK:
            torch, processor, model = _load()
            inputs = processor(samples, sampling_rate=16000, return_tensors="pt")
            with torch.inference_mode():
                logits = model(**inputs).logits
        ids = logits.argmax(dim=-1)[0].tolist()
        blank = processor.tokenizer.pad_token_id
        collapsed = []
        previous = None
        for token_id in ids:
            if token_id != previous and token_id != blank:
                collapsed.append(token_id)
            previous = token_id
        predicted = processor.tokenizer.convert_ids_to_tokens(collapsed)
        predicted = [token for token in predicted if token not in processor.tokenizer.all_special_tokens and token.strip()]
        if not predicted or len(predicted) > 30:
            base["reason"] = "音素模型未给出可解释的短音素序列。"
        else:
            base.update({"status":"tentative","predicted":predicted,"possible_substitutions":align(target,predicted),
                         "reason":"模型给出试验性 IPA 音素假设；短词或口音差异可能造成错误。"})
    except (FileNotFoundError, ImportError, OSError, ValueError, RuntimeError) as exc:
        base["reason"] = f"本地音素模型不可用：{exc}"
    return base, round((perf_counter()-started)*1000,1)
