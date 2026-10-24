"""Load PCM WAV and convert it to 16 kHz mono floating point audio."""
from __future__ import annotations

import io
import wave
from dataclasses import dataclass

import numpy as np
from scipy.signal import resample_poly
from math import gcd


@dataclass(frozen=True)
class Audio:
    samples: np.ndarray
    sample_rate: int
    source_rate: int
    channels: int


def load_wav(data: bytes) -> Audio:
    try:
        with wave.open(io.BytesIO(data), "rb") as wav:
            channels = wav.getnchannels()
            source_rate = wav.getframerate()
            width = wav.getsampwidth()
            count = wav.getnframes()
            if wav.getcomptype() != "NONE" or channels not in (1, 2) or width not in (1, 2, 3, 4):
                raise ValueError("需要单声道或双声道、8/16/24/32-bit PCM WAV。")
            if source_rate < 8000 or source_rate > 192000:
                raise ValueError("采样率需在 8–192 kHz 之间。")
            if count / source_rate < 0.12 or count / source_rate > 30:
                raise ValueError("录音长度需在 0.12–30 秒之间。")
            raw = wav.readframes(count)
    except (wave.Error, EOFError) as exc:
        raise ValueError("无法读取 WAV；请使用未压缩 PCM WAV。") from exc
    if width == 1:
        samples = (np.frombuffer(raw, dtype=np.uint8).astype(np.float64) - 128) / 128
    elif width == 2:
        samples = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768
    elif width == 3:
        octets = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        values = octets[:, 0].astype(np.int32) | (octets[:, 1].astype(np.int32) << 8) | (octets[:, 2].astype(np.int32) << 16)
        values = np.where(values & 0x800000, values - 0x1000000, values)
        samples = values.astype(np.float64) / 8388608
    else:
        samples = np.frombuffer(raw, dtype="<i4").astype(np.float64) / 2147483648
    if samples.size == 0 or samples.size % channels:
        raise ValueError("WAV 音频数据为空或不完整。")
    samples = samples.reshape(-1, channels).mean(axis=1)
    if source_rate != 16000:
        divisor = gcd(source_rate, 16000)
        samples = resample_poly(samples, 16000 // divisor, source_rate // divisor)
    return Audio(samples.astype(np.float32), 16000, source_rate, channels)
