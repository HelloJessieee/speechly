import io
import unittest
import wave
from unittest.mock import patch

import numpy as np
from pydantic import ValidationError

from speech_mirror.pipeline import analyze
from speech_mirror.phonemes import align
from speech_mirror.schema import Result
from speech_mirror.coach import _parse_response


def wav(samples, rate=16000):
    stream = io.BytesIO()
    with wave.open(stream, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(rate)
        writer.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())
    return stream.getvalue()


class EngineTests(unittest.TestCase):
    def test_sine_pitch_and_duration(self):
        t = np.arange(32000) / 16000
        result = analyze(wav(0.3 * np.sin(2 * np.pi * 200 * t)))
        self.assertAlmostEqual(result["measurements"]["median_f0_hz"], 200, delta=3)
        self.assertGreater(result["measurements"]["voiced_duration_s"], 1.85)
        self.assertGreater(result["measurements"]["voiced_ratio"], .9)
        self.assertAlmostEqual(result["measurements"]["rms_dbfs"], -13.5, delta=0.4)
        self.assertEqual(result["coach"]["source"], "rule_fallback")

    def test_silence_has_null_pitch(self):
        result = analyze(wav(np.zeros(16000)))
        self.assertFalse(result["audio_quality"]["usable"])
        self.assertIsNone(result["measurements"]["median_f0_hz"])
        self.assertIsNone(result["measurements"]["f0_stability_cents"])
        self.assertEqual(result["visual_data"]["voiced_intervals"], [])

    def test_noise_does_not_become_voiced(self):
        noise = np.random.default_rng(5).normal(0, .1, 16000)
        result = analyze(wav(noise))
        self.assertIsNone(result["measurements"]["median_f0_hz"])
        self.assertFalse(result["audio_quality"]["usable"])

    def test_quiet_microphone_voice_is_not_reported_as_zero(self):
        time = np.arange(32000) / 16000
        voice = .0006 * np.sin(2 * np.pi * 180 * time)
        voice += np.random.default_rng(0).normal(0, .0001, len(time))
        result = analyze(wav(voice))
        self.assertEqual(result["measurements"]["duration_s"], 2.0)
        self.assertGreater(result["measurements"]["voiced_duration_s"], 1.8)
        self.assertAlmostEqual(result["measurements"]["median_f0_hz"], 180, delta=3)
        self.assertTrue(result["audio_quality"]["usable"])

    def test_clipping_warns(self):
        result = analyze(wav(np.ones(16000)))
        self.assertTrue(any("削波" in warning for warning in result["audio_quality"]["warnings"]))

    def test_short_file_rejected(self):
        with self.assertRaisesRegex(ValueError, "长度"):
            analyze(wav(np.zeros(100)))

    def test_resampling(self):
        t = np.arange(24000) / 24000
        result = analyze(wav(.2 * np.sin(2 * np.pi * 150 * t), 24000))
        self.assertAlmostEqual(result["measurements"]["median_f0_hz"], 150, delta=3)
        self.assertTrue(any("重采样" in warning for warning in result["audio_quality"]["warnings"]))

    def test_unknown_exercise_rejected(self):
        with self.assertRaisesRegex(ValueError, "未知"):
            analyze(wav(np.zeros(16000)), "unknown")

    def test_voicing_timeline_shows_pause(self):
        tone = .3 * np.sin(2 * np.pi * 180 * np.arange(4800) / 16000)
        result = analyze(wav(np.concatenate([tone, np.zeros(4800), tone])))
        self.assertEqual(len(result["visual_data"]["voiced_intervals"]), 2)
        self.assertGreater(result["measurements"]["longest_voicing_gap_s"], .2)

    def test_phone_alignment_is_tentative(self):
        differences = align(["θ", "ɹ", "iː"], ["s", "iː"])
        self.assertEqual(sorted(item["type"] for item in differences), ["deletion", "substitution"])
        self.assertTrue(all(item["certainty"] == "tentative" for item in differences))

    def test_result_schema_rejects_fabricated_confidence(self):
        result = analyze(wav(np.zeros(16000)))
        result["phoneme_assessment"]["confidence"] = 0.95
        with self.assertRaises(ValidationError):
            Result.model_validate(result)

    def test_gemma_response_is_labelled_and_validated(self):
        coach = _parse_response('{"feedback":"下次平稳地多保持半秒。","next_exercise":"重复当前练习","visualization":"duration_comparison"}', allow_lips=False)
        self.assertEqual(coach.source, "gemma_local")
        with self.assertRaises(ValueError):
            _parse_response('{"feedback":"准确率95%","next_exercise":"重复当前练习","visualization":"none"}', allow_lips=False)
        with self.assertRaises(ValueError):
            _parse_response('{"feedback":"请调整舌尖位置。","next_exercise":"重复当前练习","visualization":"none"}', allow_lips=False)
        with self.assertRaises(ValueError):
            _parse_response('{"feedback":"观察嘴唇","next_exercise":"重复当前练习","visualization":"lip_shape_comparison"}', allow_lips=False)

    def test_impossible_video_counts_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "跟踪视频帧"):
            analyze(wav(np.zeros(16000)), visual_features={"sampled_frames": 2, "tracked_frames": 4})

    def test_free_speech_requires_user_confirmation_before_coaching(self):
        signal = wav(.2 * np.sin(2 * np.pi * 180 * np.arange(16000) / 16000))
        hypothesis = {"status": "tentative", "text": "3.", "model": "local test", "reason": None}
        with patch("speech_mirror.asr.transcribe", return_value=(hypothesis, 2.0)), patch("speech_mirror.coach.generate") as gemma:
            first = analyze(signal, "free_speech", use_gemma=True)
            self.assertEqual(first["intent"]["status"], "awaiting_confirmation")
            self.assertEqual(first["asr"]["text"], "3.")
            gemma.assert_not_called()
        phones = {"status": "tentative", "target": ["θ", "ɹ", "iː"], "predicted": ["θ", "ɹ", "iː"], "possible_substitutions": [], "confidence": None}
        with patch("speech_mirror.asr.transcribe", return_value=(hypothesis, 2.0)), patch("speech_mirror.phonemes.recognize", return_value=(phones, 3.0)) as recognizer:
            second = analyze(signal, "free_speech", intended_text="three")
            self.assertEqual(recognizer.call_args.args[1], ["θ", "ɹ", "iː"])
        self.assertEqual(second["intent"]["status"], "confirmed")
        self.assertIn("相同", second["intent"]["comparison"])
        self.assertIn("three", second["coach"]["feedback"])

    def test_free_speech_mismatch_is_tentative_and_focuses_one_word(self):
        signal = wav(.2 * np.sin(2 * np.pi * 180 * np.arange(16000) / 16000))
        hypothesis = {"status": "tentative", "text": "I need some water", "model": "local test", "reason": None}
        with patch("speech_mirror.asr.transcribe", return_value=(hypothesis, 2.0)):
            result = analyze(signal, "free_speech", intended_text="I need warm water")
        self.assertIn("模型误差", result["intent"]["comparison"])
        self.assertIn("warm", result["coach"]["feedback"])
        self.assertIn("some", result["coach"]["feedback"])

    def test_free_speech_can_recognize_without_periodic_pitch(self):
        aperiodic = wav(np.random.default_rng(7).normal(0, .08, 16000))
        hypothesis = {"status": "tentative", "text": "possible words", "model": "local test", "reason": None}
        with patch("speech_mirror.asr.transcribe", return_value=(hypothesis, 2.0)):
            result = analyze(aperiodic, "free_speech")
        self.assertTrue(result["audio_quality"]["usable"])
        self.assertEqual(result["measurements"]["duration_s"], 1.0)
        self.assertEqual(result["measurements"]["voiced_duration_s"], 0)
        self.assertIn("不等于没有说话", result["observations"][0])


if __name__ == "__main__":
    unittest.main()
