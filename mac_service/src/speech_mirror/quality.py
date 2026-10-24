"""Input quality warnings, without claiming calibrated loudness."""
import numpy as np


def inspect(samples: np.ndarray, source_rate: int, channels: int = 1) -> dict:
    peak = float(np.max(np.abs(samples)))
    rms = float(np.sqrt(np.mean(np.square(samples, dtype=np.float64))))
    clipped = float(np.mean(np.abs(samples) >= 0.999))
    warnings = []
    if source_rate != 16000:
        warnings.append(f"输入为 {source_rate} Hz，已重采样到 16000 Hz。")
    if rms < 0.00025:
        warnings.append("录音接近数字静音；请检查麦克风是否收到声音。")
    elif rms < 0.003:
        warnings.append("录音电平很低；已尝试检测有声，建议靠近麦克风并回听确认。")
    elif rms < 0.012:
        warnings.append("录音电平偏低；可靠近麦克风重试。")
    if clipped > 0.01:
        warnings.append("录音有明显削波；请远离麦克风或降低输入增益。")
    elif peak >= 0.999:
        warnings.append("录音可能有少量削波。")
    return {
        "usable": rms >= 0.00025 and clipped <= 0.05,
        "warnings": warnings,
        "input_sample_rate_hz": source_rate,
        "analysis_sample_rate_hz": 16000,
        "channels": channels,
        "peak_dbfs": round(float(20 * np.log10(max(peak, 1e-10))), 1),
        "clipped_percent": round(clipped * 100, 2),
    }
