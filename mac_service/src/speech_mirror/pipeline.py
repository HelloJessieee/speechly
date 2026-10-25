"""WAV to measured, provenance-labelled JSON."""
from __future__ import annotations

from time import perf_counter
import re
from difflib import SequenceMatcher

from .audio_io import load_wav
from .quality import inspect
from .dsp import measure
from .assessment import assess
from .targets import EXERCISES
from .schema import Result, VisualFeatures


def _english_words(value: str) -> str:
    # Whisper's normalizer maps common spoken numbers to the same written form.
    from transformers.models.whisper.english_normalizer import EnglishTextNormalizer
    return EnglishTextNormalizer({})(value)


def _free_speech_step(wanted: str, heard: str | None, language: str = "zh") -> str:
    wanted_words = wanted.split()
    heard_words = (heard or "").split()
    if not wanted_words:
        return "Replay the recording and confirm what you meant to say." if language == "en" else "先回听录音，再确认你原本想说的英语词句。"
    matcher = SequenceMatcher(a=_english_words(wanted).split(), b=_english_words(heard or "").split())
    for tag, start, _, observed_start, observed_end in matcher.get_opcodes():
        if tag != "equal" and start < len(wanted_words):
            target_word = wanted_words[start].strip(".,!?;:")[:30]
            heard_part = " ".join(heard_words[observed_start:observed_end])[:30] or ("nothing" if language == "en" else "未听到")
            if language == "en":
                return f"Replay word {start + 1}: you meant '{target_word}', while Whisper heard '{heard_part}'. Say '{target_word}' alone, then in the sentence. Whisper may be wrong."
            return f"先回听第 {start + 1} 个词：你想说“{target_word}”，模型听成“{heard_part}”。把“{target_word}”单独说一次，再连回整句。模型也可能听错。"
        if tag != "equal":
            if language == "en":
                return "Whisper may have heard extra words. Replay the ending, then repeat your confirmed sentence. Whisper may be wrong."
            return "模型可能多听到了内容。先回听句尾，再按你确认的原句说一次并对比；模型也可能听错。"
    focus = wanted_words[0].strip(".,!?;:")[:30]
    if language == "en":
        return f"Whisper's words match your confirmed sentence. Replay '{focus}', say it alone, then in the sentence and compare recordings."
    return f"模型这次听到的词句与你确认的一致。回听第 1 个词“{focus}”，单独说一次，再连回整句并对比两次录音。"


def analyze(wav_bytes: bytes, exercise_id: str = "vowel_u_sustain", target_duration_s: float | None = None,
            phonemes: bool = False, use_gemma: bool = False, visual_features: dict | None = None,
            intended_text: str | None = None, language: str = "zh", skip_phonemes: bool = False) -> dict:
    if language not in {"zh", "en"}:
        raise ValueError("Unsupported response language.")
    if exercise_id not in EXERCISES:
        raise ValueError("未知练习项目。")
    target = EXERCISES[exercise_id]
    if intended_text is not None:
        intended_text = intended_text.strip()
        if len(intended_text) > 160 or any(ord(c) < 32 for c in intended_text):
            raise ValueError("原本想说的话需在 160 字以内，且不能包含控制字符。")
        intended_text = intended_text or None
    if exercise_id == "free_speech" and intended_text and not re.search(r"[A-Za-z]", intended_text):
        raise ValueError("当前英语识别模型仅支持英语；请填写想说的英语词句。")
    if target_duration_s is None:
        target_duration_s = target["target_duration_s"]
    if target_duration_s is not None and not 0.2 <= target_duration_s <= 20:
        raise ValueError("目标时长需在 0.2–20 秒之间。")
    visual = VisualFeatures.model_validate(visual_features) if visual_features is not None else None
    if visual is not None and visual.tracked_frames > visual.sampled_frames:
        raise ValueError("跟踪视频帧不能超过取样帧数。")
    start = perf_counter()
    audio = load_wav(wav_bytes)
    quality = inspect(audio.samples, audio.source_rate, audio.channels)
    measurements, traces = measure(audio.samples, audio.sample_rate)
    if exercise_id != "free_speech" and quality["usable"] and measurements["voiced_duration_s"] < 0.15:
        quality["usable"] = False
        quality["warnings"].append("未检测到稳定周期性有声；可能是输入太轻、噪声或无声辅音，请先回听录音。")
    dsp_ms = round((perf_counter() - start) * 1000, 1)
    asr = {"status": "not_run", "text": None, "model": None, "reason": None}
    asr_ms = None
    if exercise_id == "free_speech":
        if quality["usable"] and measurements["active_duration_s"] >= 0.12:
            from .asr import transcribe
            asr, asr_ms = transcribe(audio.samples)
        else:
            asr = {"status": "unavailable", "text": None, "model": None, "reason": "录音信号不足，无法判断听到的词句。"}
    phoneme_assessment = {"status": "not_run", "target": target["phonemes"], "predicted": None, "possible_substitutions": [], "confidence": None, "model": None}
    phoneme_ms = None
    phrase_target = []
    if exercise_id == "free_speech" and intended_text:
        from .g2p import phonemes_for_short_phrase
        phrase_target = phonemes_for_short_phrase(intended_text)
        if phrase_target:
            phoneme_assessment["target"] = phrase_target
    automatic_single_word = bool(phrase_target) and intended_text is not None and len(intended_text.split()) == 1
    if (phonemes or automatic_single_word) and not skip_phonemes:
        if exercise_id == "free_speech" and not phrase_target:
            phoneme_assessment["status"] = "unavailable"
            phoneme_assessment["reason"] = "Experimental phoneme comparison supports up to ten English words and 30 target phonemes."
        elif quality["usable"] and measurements["voiced_duration_s"] >= 0.15:
            from .phonemes import recognize
            phoneme_assessment, phoneme_ms = recognize(audio.samples, phrase_target or target["phonemes"])
        else:
            phoneme_assessment["status"] = "unavailable"
            phoneme_assessment["reason"] = "录音质量不足，未运行音素模型。"
    observations = assess(measurements, quality, target_duration_s, phoneme_assessment)
    intent = None
    if exercise_id == "free_speech":
        if quality["usable"] and measurements["voiced_duration_s"] < .15:
            observations = ["没有检测到稳定周期性有声段；这不等于没有说话，可回听录音并查看模型的文字假设。"]
        if intended_text:
            heard = _english_words(asr["text"] or "")
            wanted = _english_words(intended_text)
            if language == "en":
                comparison = "Whisper's words match your confirmed text; this does not prove pronunciation is correct." if heard == wanted and heard else "Whisper's words differ from your confirmed text; recognition can be wrong." if heard else "Whisper did not return words to compare."
            else:
                comparison = "模型听到的词句与确认内容相同；这不代表发音完全正确。" if heard == wanted and heard else "模型听到的词句与确认内容不同；可能是识别模型误差，也可能是这次发声不够清楚。" if heard else "识别模型没有可比较的结果。"
            intent = {"confirmed_text": intended_text, "status": "confirmed", "comparison": comparison}
            observations.insert(0, comparison)
        else:
            intent = {"confirmed_text": None, "status": "awaiting_confirmation" if asr["status"] == "tentative" else "unavailable", "comparison": None}
    if not quality["usable"] or measurements["voiced_duration_s"] < 0.15:
        feedback = "请在安静处重新录一段清晰的发声。"
        visualization = "none"
    elif target_duration_s is not None and measurements["voiced_duration_s"] < target_duration_s - 0.15:
        feedback = "下次试着把声音平稳地保持稍久一点，不用用力。"
        visualization = "duration_comparison"
    else:
        feedback = "再录一次，观察有声时长和音高曲线的变化。"
        visualization = "pitch_trace" if measurements["median_f0_hz"] is not None else "volume_trace"
    if exercise_id == "free_speech":
        if not quality["usable"]:
            feedback = "Replay the recording, check microphone input, and try again; this signal is too weak for comparison." if language == "en" else "先回听录音并检查麦克风输入，再重新说一次；本次信号不足，无法可靠对照内容。"
        else:
            feedback = _free_speech_step(intended_text, asr["text"], language) if intended_text else ("Replay the recording and confirm what you meant to say; Whisper's words are only a guess." if language == "en" else "先回听录音，再确认你原本想说的英语词句；模型文字只是听到的假设。")
        visualization = "volume_trace" if measurements["active_duration_s"] else "none"
    elif exercise_id.startswith("word_") and quality["usable"]:
        differences = phoneme_assessment["possible_substitutions"]
        if phoneme_assessment["status"] == "tentative" and differences:
            first = differences[0]
            feedback = f"音素模型提示目标 /{first['expected'] or '—'}/ 与听到的 /{first['observed'] or '—'}/ 可能不同。先回听，再把“{target['text']}”慢速说一次；模型也可能听错。"
        elif phoneme_assessment["status"] == "tentative":
            feedback = f"模型的音素假设与目标序列相同。回听“{target['text']}”，慢速重说一次并比较两次录音；这不等于已经发准。"
        else:
            feedback = f"先回听“{target['text']}”，慢速重说一次，再回听比较两次录音。"
    coach = {"source": "rule_fallback", "feedback": feedback, "next_exercise": "回听后再说一次同一句话。" if exercise_id == "free_speech" else "重复同一练习一次。", "visualization": visualization}
    if language == "en":
        coach["next_exercise"] = "Replay, then record the same sentence once more." if exercise_id == "free_speech" else "Repeat the same exercise once."
    gemma_ms = None
    if use_gemma and quality["usable"] and (exercise_id != "free_speech" or intended_text):
        from .coach import generate
        evidence = {
            "exercise": target["label"], "target_phonemes": phoneme_assessment["target"],
            "target_duration_s": target_duration_s, "measurements": measurements,
            "audio_quality_warnings": quality["warnings"],
            "phoneme_assessment": {"status": phoneme_assessment["status"], "target": phoneme_assessment["target"],
                                   "predicted": phoneme_assessment["predicted"],
                                   "possible_substitutions": phoneme_assessment["possible_substitutions"][:4]},
            "observations": observations,
            "visual_features": visual.model_dump() if visual is not None else None,
            "asr_hypothesis": asr["text"] if exercise_id == "free_speech" else None,
            "user_confirmed_intent": intended_text,
            "intent_comparison": intent["comparison"] if intent is not None else None,
        }
        try:
            kwargs = {"language": "en"} if language == "en" else {}
            model_coach, gemma_ms = generate(evidence, allow_lips=visual is not None and visual.tracked_frames >= 3 and (visual.tracked_fraction or 0) >= .6, **kwargs)
            candidate = model_coach.model_dump(exclude_none=True)
            mentioned_phones = re.findall(r"/([^/\s]{1,8})/", candidate["feedback"] + " " + candidate["next_exercise"])
            supported_phones = {item["expected"] for item in phoneme_assessment["possible_substitutions"]}
            practice_text = candidate["feedback"] + " " + candidate["next_exercise"]
            action_pattern = r"replay|repeat|say|compare|slow|listen|practice|try" if language == "en" else r"回听|重说|练习|放慢|慢速|单独|分开|连回|比较"
            if exercise_id == "free_speech" and not re.search(action_pattern, practice_text, re.IGNORECASE):
                coach["reason"] = "Gemma did not give a concrete practice step, so a rule-based suggestion is shown." if language == "en" else "Gemma 建议缺少具体练习动作，改用依据模型假设和确认原意生成的步骤。"
            elif exercise_id.startswith("word_") and (target["text"].lower() not in practice_text.lower() or not re.search(r"回听|对照|放慢|慢速|单独|重说|比较|练习", practice_text)):
                coach["reason"] = "Gemma 没有点名目标词和具体动作，改用音素对照的练习步骤。"
            elif any(phone not in supported_phones for phone in mentioned_phones):
                coach["reason"] = "Gemma focused on a phoneme without evidence of a difference, so a replay step is shown." if language == "en" else "Gemma 聚焦的音素没有差异证据，改用回听与重说步骤。"
            else:
                coach = candidate
        except Exception as exc:
            coach["reason"] = f"Local Gemma did not return a usable suggestion: {exc}" if language == "en" else f"本地 Gemma 未能生成可用建议：{exc}"
    elif use_gemma and not quality["usable"]:
        coach["reason"] = "Recording quality was insufficient; a rule-based retry suggestion is shown." if language == "en" else "录音质量不足，本次按规则建议重新录音。"
    result = {
        "schema_version": "1.0", "exercise_id": exercise_id,
        "audio_quality": quality, "measurements": measurements,
        "phoneme_assessment": phoneme_assessment, "observations": observations,
        "coach": coach,
        "performance": {"dsp_ms": dsp_ms, "phoneme_ms": phoneme_ms, "gemma_ms": gemma_ms, "asr_ms": asr_ms},
        "visual_data": traces,
        "reference": {"target_duration_s": target_duration_s},
        "visual_features": visual.model_dump() if visual is not None else None,
        "asr": asr if exercise_id == "free_speech" else None,
        "intent": intent,
    }
    return Result.model_validate(result).model_dump(exclude_none=False)
