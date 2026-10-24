"""Conservative measurements for short sustained speech."""
from __future__ import annotations

import numpy as np
from scipy.signal import correlate, find_peaks


def measure(samples: np.ndarray, sample_rate: int = 16000) -> tuple[dict, dict]:
    duration = len(samples) / sample_rate
    rms = float(np.sqrt(np.mean(np.square(samples, dtype=np.float64))))
    dbfs = 20 * np.log10(max(rms, 1e-10))
    frame_size = int(0.04 * sample_rate)
    hop = int(0.01 * sample_rate)
    pitches: list[float] = []
    pitch_trace: list[dict] = []
    volume_trace: list[dict] = []
    voiced_starts: list[int] = []
    active_starts: list[int] = []
    active_levels: list[float] = []
    voiced_candidates: list[tuple[int, float]] = []
    frame_rms = []
    frames = []
    for start in range(0, len(samples) - frame_size + 1, hop):
        frame = samples[start:start + frame_size].astype(np.float64)
        frames.append((start, frame))
        frame_rms.append(float(np.sqrt(np.mean(frame * frame))))
    # A fixed -44 dBFS gate discarded legitimate quiet microphone recordings.
    # Retain a low digital floor, then use relative energy and periodicity.
    threshold = max(0.0003, (max(frame_rms) if frame_rms else 0) * 0.12)
    for (start, frame), energy in zip(frames, frame_rms):
        stamp = round((start + frame_size / 2) / sample_rate, 3)
        volume_trace.append({"time_s": stamp, "dbfs": round(float(20 * np.log10(max(energy, 1e-10))), 1)})
        if energy < threshold:
            continue
        active_starts.append(start)
        active_levels.append(float(20 * np.log10(max(energy, 1e-10))))
        centered = frame - np.mean(frame)
        # Normalized lag correlation reduces false pitch on noise and silence.
        min_lag, max_lag = int(sample_rate / 500), int(sample_rate / 50)
        numerators = correlate(centered, centered, mode="full", method="fft")[len(centered)-1 + min_lag:len(centered) + max_lag]
        squared = centered * centered
        cumulative = np.concatenate(([0.0], np.cumsum(squared)))
        lags = np.arange(min_lag, max_lag + 1)
        left_energy = cumulative[len(centered) - lags]
        right_energy = cumulative[len(centered)] - cumulative[lags]
        scores = numerators / np.maximum(np.sqrt(left_energy * right_energy), 1e-12)
        peaks, _ = find_peaks(scores)
        if len(peaks) == 0:
            peaks = np.array([int(np.argmax(scores))])
        best_score = float(np.max(scores[peaks]))
        candidates = peaks[scores[peaks] >= max(0.55, best_score * 0.95)]
        if len(candidates) == 0:
            continue
        best_lag = int(lags[candidates[0]])
        f0 = sample_rate / best_lag
        voiced_candidates.append((start, f0))
    # A brief isolated periodic frame is not enough evidence of sustained voice.
    runs: list[list[tuple[int, float]]] = []
    for candidate in voiced_candidates:
        if not runs or candidate[0] - runs[-1][-1][0] > hop * 1.5:
            runs.append([])
        runs[-1].append(candidate)
    for run in runs:
        if len(run) < 3:
            continue
        for start, f0 in run:
            pitches.append(f0)
            voiced_starts.append(start)
            pitch_trace.append({"time_s": round((start + frame_size / 2) / sample_rate, 3), "f0_hz": round(f0, 1)})
    enough = len(voiced_starts) >= 5
    median_f0 = float(np.median(pitches)) if enough else None
    stability = None
    if enough and median_f0:
        cents = 1200 * np.log2(np.asarray(pitches) / median_f0)
        stability = float(1.4826 * np.median(np.abs(cents - np.median(cents))))
    longest_gap = None
    if len(voiced_starts) >= 2:
        longest_gap = max(0.0, max((b - a - hop) / sample_rate for a, b in zip(voiced_starts, voiced_starts[1:])))
    voiced_intervals = []
    if voiced_starts:
        first = previous = voiced_starts[0]
        for start in voiced_starts[1:]:
            if start - previous > frame_size:
                voiced_intervals.append({"start_s": round(first / sample_rate, 3), "end_s": round(min(duration, (previous + frame_size) / sample_rate), 3)})
                first = start
            previous = start
        voiced_intervals.append({"start_s": round(first / sample_rate, 3), "end_s": round(min(duration, (previous + frame_size) / sample_rate), 3)})
    voiced_duration = min(duration, len(voiced_starts) * hop / sample_rate)
    measurements = {
        "duration_s": round(duration, 3),
        "active_duration_s": round(min(duration, len(active_starts) * hop / sample_rate), 3),
        "voiced_duration_s": round(voiced_duration, 3),
        "voiced_ratio": round(voiced_duration / duration, 3),
        "first_voiced_s": round(voiced_starts[0] / sample_rate, 3) if voiced_starts else None,
        "last_voiced_s": round(min(duration, (voiced_starts[-1] + frame_size) / sample_rate), 3) if voiced_starts else None,
        "longest_voicing_gap_s": round(longest_gap, 3) if longest_gap is not None else None,
        "rms_dbfs": round(float(dbfs), 1),
        "volume_iqr_db": round(float(np.percentile(active_levels, 75) - np.percentile(active_levels, 25)), 1) if len(active_levels) >= 5 else None,
        "median_f0_hz": round(median_f0, 1) if median_f0 is not None else None,
        "f0_p10_hz": round(float(np.percentile(pitches, 10)), 1) if enough else None,
        "f0_p90_hz": round(float(np.percentile(pitches, 90)), 1) if enough else None,
        "f0_stability_cents": round(stability, 1) if stability is not None else None,
    }
    return measurements, {"pitch_trace": pitch_trace, "volume_trace": volume_trace[::5], "voiced_intervals": voiced_intervals}
