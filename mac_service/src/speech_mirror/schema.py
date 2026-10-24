"""Validated public request and result contract."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Reference(StrictModel):
    target_duration_s: float | None = None


class Request(StrictModel):
    exercise_id: str
    target_text: str | None = None
    target_phonemes: list[str] | None = None
    audio_path: str
    user_goal: str | None = None
    reference: Reference = Field(default_factory=Reference)
    visual_features: dict | None = None


class AudioQuality(StrictModel):
    usable: bool
    warnings: list[str]
    input_sample_rate_hz: int
    analysis_sample_rate_hz: int
    channels: int
    peak_dbfs: float
    clipped_percent: float


class Measurements(StrictModel):
    duration_s: float
    active_duration_s: float
    voiced_duration_s: float
    voiced_ratio: float
    first_voiced_s: float | None
    last_voiced_s: float | None
    longest_voicing_gap_s: float | None
    rms_dbfs: float
    volume_iqr_db: float | None
    median_f0_hz: float | None
    f0_p10_hz: float | None
    f0_p90_hz: float | None
    f0_stability_cents: float | None


class PhoneDifference(StrictModel):
    type: Literal["substitution", "insertion", "deletion"]
    expected: str | None
    observed: str | None
    certainty: Literal["tentative"]


class PhonemeAssessment(StrictModel):
    status: Literal["not_run", "unavailable", "tentative"]
    target: list[str]
    predicted: list[str] | None
    possible_substitutions: list[PhoneDifference]
    confidence: None = None
    reason: str | None = None


class Coach(StrictModel):
    source: Literal["gemma_local", "mock", "rule_fallback"]
    feedback: str
    next_exercise: str
    visualization: Literal["duration_comparison", "pitch_trace", "volume_trace", "lip_shape_comparison", "none"]
    reason: str | None = None


class VisualFeatures(StrictModel):
    sampled_frames: int = Field(ge=0, le=300)
    tracked_frames: int = Field(ge=0, le=300)
    tracked_fraction: float | None = Field(default=None, ge=0, le=1)
    median_aperture_ratio: float | None = Field(default=None, ge=0, le=2)
    median_width_ratio: float | None = Field(default=None, ge=0, le=2)
    median_pucker: float | None = Field(default=None, ge=0, le=1)
    median_funnel: float | None = Field(default=None, ge=0, le=1)


class Performance(StrictModel):
    dsp_ms: float | None
    phoneme_ms: float | None
    gemma_ms: float | None
    asr_ms: float | None = None


class ASR(StrictModel):
    status: Literal["not_run", "unavailable", "tentative"]
    text: str | None = None
    model: str | None = None
    reason: str | None = None


class Intent(StrictModel):
    confirmed_text: str | None = None
    status: Literal["awaiting_confirmation", "confirmed", "unavailable"]
    comparison: str | None = None


class PitchPoint(StrictModel):
    time_s: float
    f0_hz: float


class VolumePoint(StrictModel):
    time_s: float
    dbfs: float


class VoicedInterval(StrictModel):
    start_s: float
    end_s: float


class VisualData(StrictModel):
    pitch_trace: list[PitchPoint]
    volume_trace: list[VolumePoint]
    voiced_intervals: list[VoicedInterval]


class Result(StrictModel):
    schema_version: Literal["1.0"]
    exercise_id: str
    audio_quality: AudioQuality
    measurements: Measurements
    phoneme_assessment: PhonemeAssessment
    observations: list[str]
    coach: Coach
    performance: Performance
    visual_data: VisualData
    reference: Reference
    visual_features: VisualFeatures | None = None
    asr: ASR | None = None
    intent: Intent | None = None
