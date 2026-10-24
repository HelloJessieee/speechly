"""Offline, tentative English transcription. No inferred intent or confidence score."""
from __future__ import annotations

import os
import threading
from collections import OrderedDict
from hashlib import sha256
from pathlib import Path
from time import perf_counter

import numpy as np

MODEL = Path(__file__).parents[2] / "models" / "asr" / "whisper-tiny.en"
_LOCK = threading.Lock()
_PROCESSOR = None
_MODEL = None
_PATH = None
_RECENT: OrderedDict[tuple[str, bytes], dict] = OrderedDict()


def model_path() -> Path:
    return Path(os.environ.get("SPEECH_MIRROR_ASR_MODEL", str(MODEL))).expanduser()


def transcribe(samples: np.ndarray) -> tuple[dict, float]:
    """Return a listening hypothesis, never an assertion of what was intended."""
    global _MODEL, _PROCESSOR, _PATH
    started = perf_counter()
    path = model_path()
    if not (path / "model.safetensors").is_file():
        return {"status": "unavailable", "text": None, "model": str(path), "reason": "本地英语识别模型未下载。"}, 0.0
    try:
        with _LOCK:
            # The iPhone submits the same recording before and after the user
            # confirms the intended sentence. Cache only its transcript, never
            # the audio, so later phoneme or Gemma requests avoid another ASR run.
            cache_key = (str(path), sha256(samples.tobytes()).digest())
            if cache_key in _RECENT:
                _RECENT.move_to_end(cache_key)
                return dict(_RECENT[cache_key]), 0.0
            import torch
            from transformers import WhisperForConditionalGeneration, WhisperProcessor

            if _MODEL is None or _PATH != path:
                _PROCESSOR = WhisperProcessor.from_pretrained(path, local_files_only=True)
                _MODEL = WhisperForConditionalGeneration.from_pretrained(path, local_files_only=True)
                _MODEL.eval()
                device = os.environ.get("SPEECH_MIRROR_ASR_DEVICE") or ("mps" if torch.backends.mps.is_available() else "cpu")
                if device not in {"cpu", "mps"}:
                    raise ValueError("SPEECH_MIRROR_ASR_DEVICE must be cpu or mps")
                _MODEL.to(device)
                _PATH = path
            inputs = _PROCESSOR.feature_extractor(samples.astype(np.float32), sampling_rate=16000, return_attention_mask=True, return_tensors="pt")
            features = inputs.input_features.to(_MODEL.device)
            with torch.inference_mode():
                ids = _MODEL.generate(features, attention_mask=inputs.attention_mask.to(_MODEL.device), max_new_tokens=96)
            hypothesis = _PROCESSOR.tokenizer.batch_decode(ids, skip_special_tokens=True)[0].strip()
        if not hypothesis:
            return {"status": "unavailable", "text": None, "model": str(path), "reason": "模型未识别出清楚的英语词句，请回听或重录。"}, round((perf_counter() - started) * 1000, 1)
        result = {"status": "tentative", "text": hypothesis, "model": str(path), "reason": None}
        with _LOCK:
            _RECENT[cache_key] = result
            if len(_RECENT) > 32:
                _RECENT.popitem(last=False)
        return result, round((perf_counter() - started) * 1000, 1)
    except Exception as exc:
        return {"status": "unavailable", "text": None, "model": str(path), "reason": f"本地识别失败：{type(exc).__name__}: {exc}"}, round((perf_counter() - started) * 1000, 1)
