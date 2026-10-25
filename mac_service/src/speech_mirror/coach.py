"""Local Gemma coaching over validated measurements only."""
from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path
from time import perf_counter

from .schema import Coach

MODEL = Path(__file__).parents[2] / "models" / "gemma" / "gemma-4-E2B-it.litertlm"
_LOCK = threading.Lock()
_ENGINE = None
_ENGINE_PATH: Path | None = None
_ENGINE_BACKEND: str | None = None
ALLOWED_VISUALIZATIONS = {"duration_comparison", "pitch_trace", "volume_trace", "lip_shape_comparison", "none"}
UNSUPPORTED_CLAIMS = re.compile(r"(?:准确率|正确率|诊断|疾病|康复率|舌|牙|喉|声带|声门|tongue|teeth|throat|accuracy|diagnos)|\d+\s*%", re.IGNORECASE)


def model_path() -> Path:
    return Path(os.environ.get("SPEECH_MIRROR_GEMMA_MODEL", str(MODEL))).expanduser()


def model_available() -> bool:
    path = model_path()
    return path.is_file() and path.stat().st_size > 1_000_000


def _get_engine():
    global _ENGINE, _ENGINE_PATH, _ENGINE_BACKEND
    path = model_path()
    backend_name = os.environ.get("SPEECH_MIRROR_GEMMA_BACKEND", "gpu").lower()
    if backend_name not in {"gpu", "cpu"}:
        raise ValueError("SPEECH_MIRROR_GEMMA_BACKEND must be gpu or cpu")
    if not model_available():
        raise FileNotFoundError(f"本地 Gemma 模型不存在：{path}")
    if _ENGINE is None or _ENGINE_PATH != path or _ENGINE_BACKEND != backend_name:
        import litert_lm
        if _ENGINE is not None:
            _ENGINE.close()
        backend = litert_lm.Backend.GPU() if backend_name == "gpu" else litert_lm.Backend.CPU()
        _ENGINE = litert_lm.Engine(str(path), backend=backend, max_num_tokens=1024)
        _ENGINE_PATH = path
        _ENGINE_BACKEND = backend_name
    return _ENGINE


def _prompt(evidence: dict, *, language: str = "zh") -> str:
    measurements = evidence.get("measurements") or {}
    phones = evidence.get("phoneme_assessment") or {}
    visual = evidence.get("visual_features") or {}
    observations = evidence.get("observations") or []
    if language == "en":
        observations = [item for item in observations if isinstance(item, str) and not re.search(r"[\u3400-\u9fff]", item)]
    phone_summary = None
    if phones.get("status") == "tentative":
        phone_summary = {
            "target": (phones.get("target") or [])[:16],
            "heard_guess": (phones.get("predicted") or [])[:16],
            "possible_differences": (phones.get("possible_substitutions") or [])[:4],
        }
    compact = {
        "target": evidence.get("user_confirmed_intent") or evidence.get("exercise"),
        "heard_guess": evidence.get("asr_hypothesis"),
        "comparison": evidence.get("intent_comparison"),
        "duration_s": measurements.get("duration_s"),
        "voiced_s": measurements.get("voiced_duration_s"),
        "level_dbfs": measurements.get("rms_dbfs"),
        "pitch_hz": measurements.get("median_f0_hz"),
        "warnings": (evidence.get("audio_quality_warnings") or [])[:2],
        "observations": observations[:2],
        "phones": phone_summary,
        "lip_tracking": visual.get("tracked_fraction") if visual.get("tracked_frames", 0) >= 3 else None,
        "lip_aperture_ratio": visual.get("median_aperture_ratio") if visual.get("tracked_frames", 0) >= 3 else None,
    }
    data = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    if language == "en":
        return (
            "Use only this evidence. ASR and phonemes are guesses, not proof. Give one concrete English practice step "
            "naming a word in target: replay, say it alone, then in the sentence. No diagnosis, accuracy score, "
            "or claims about unmeasured tongue, teeth or throat. Do not name a specific IPA sound unless "
            "phones.possible_differences includes it as an expected sound. Return one compact JSON object with feedback "
            "(under 70 characters), next_exercise (under 50 characters), and visualization "
            "(none, volume_trace, pitch_trace, duration_comparison, or lip_shape_comparison). "
            "Use lip_shape_comparison only with good lip tracking. Evidence: " + data
        )
    return (
        "只根据证据给一个简短中文练习动作，点名目标词：回听、单独慢说、再放回整句。"
        "ASR和音素只是猜测；不得声称准确率、诊断、舌牙喉或未测到的变化。"
        "除非possible_differences有目标音素，不要点名某个音素。"
        "只返回JSON，字段feedback（不超过70字）、next_exercise、visualization。"
        "visualization选none、volume_trace、pitch_trace、duration_comparison或lip_shape_comparison；"
        "口型跟踪不足时不要选最后一项。证据：" + data
    )


def _parse_response(raw: str, *, allow_lips: bool) -> Coach:
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("Gemma 没有返回 JSON 对象")
    value = json.loads(raw[start:end + 1])
    if not isinstance(value, dict) or set(value) != {"feedback", "next_exercise", "visualization"}:
        raise ValueError("Gemma 返回字段不符合约定")
    feedback, next_exercise, visualization = (value[key] for key in ("feedback", "next_exercise", "visualization"))
    if not isinstance(feedback, str) or not 1 <= len(feedback.strip()) <= 120:
        raise ValueError("Gemma 建议长度不符合约定")
    if not isinstance(next_exercise, str) or not 1 <= len(next_exercise.strip()) <= 100:
        raise ValueError("Gemma 下一练习长度不符合约定")
    if visualization not in ALLOWED_VISUALIZATIONS or (visualization == "lip_shape_comparison" and not allow_lips):
        raise ValueError("Gemma 请求了不受支持的可视化")
    if UNSUPPORTED_CLAIMS.search(feedback + next_exercise):
        raise ValueError("Gemma 返回了未经证实的断言")
    return Coach(source="gemma_local", feedback=feedback.strip(), next_exercise=next_exercise.strip(), visualization=visualization)


def generate(evidence: dict, *, allow_lips: bool, language: str = "zh") -> tuple[Coach, float]:
    """Generate a validated coach response; callers handle fallback on error."""
    started = perf_counter()
    with _LOCK:
        engine = _get_engine()
        import litert_lm
        with engine.create_conversation(max_output_tokens=96,
                                        thinking_config=litert_lm.ThinkingConfig(enable_thinking=False)) as conversation:
            response = conversation.send_message(_prompt(evidence, language=language))
        coach = _parse_response(str(response), allow_lips=allow_lips)
        if language == "en" and re.search(r"[\u3400-\u9fff]", coach.feedback + coach.next_exercise):
            raise ValueError("Gemma response was not in English")
    return coach, round((perf_counter() - started) * 1000, 1)


def warmup() -> float:
    """Load Gemma and run one tiny generation before the first user request."""
    started = perf_counter()
    with _LOCK:
        engine = _get_engine()
        import litert_lm
        with engine.create_conversation(max_output_tokens=4,
                                        thinking_config=litert_lm.ThinkingConfig(enable_thinking=False)) as conversation:
            conversation.send_message("Reply OK.")
    return round((perf_counter() - started) * 1000, 1)
