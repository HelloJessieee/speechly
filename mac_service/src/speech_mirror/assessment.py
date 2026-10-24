"""Deterministic observations, not pronunciation scores."""


def assess(measurements: dict, quality: dict, target_duration_s: float | None, phoneme_assessment: dict | None = None) -> list[str]:
    if not quality["usable"]:
        return ["本次录音质量不足；先处理上方质量提示，再重新录音。"]
    observations = []
    voiced = measurements["voiced_duration_s"]
    if voiced < 0.15:
        observations.append("未检测到足够稳定的有声音段；请重试。")
        return observations
    observations.append(f"整段录音 {measurements['duration_s']:.2f} 秒，检测到周期性有声 {voiced:.2f} 秒，占录音 {measurements['voiced_ratio'] * 100:.0f}%。")
    if target_duration_s is not None:
        if voiced < target_duration_s - 0.15:
            observations.append(f"检测到的有声时长 {voiced:.2f} 秒，短于设定目标 {target_duration_s:.2f} 秒。")
        elif voiced > target_duration_s + 0.35:
            observations.append(f"检测到的有声时长 {voiced:.2f} 秒，长于设定目标 {target_duration_s:.2f} 秒。")
        else:
            observations.append("检测到的有声时长接近你设定的目标。")
    gap = measurements["longest_voicing_gap_s"]
    if gap is not None and gap >= 0.12 and target_duration_s is not None:
        observations.append(f"有声段中出现约 {gap:.2f} 秒的中断；可结合时间轴回听。")
    if measurements["median_f0_hz"] is None:
        observations.append("音高未能可靠测得；请在安静处持续发声后重试。")
    else:
        spread = measurements["f0_stability_cents"]
        observations.append(f"中位音高 {measurements['median_f0_hz']:.1f} Hz；本次音高波动约 {spread:.1f} 音分。它只描述变化，不判断发音是否正确。")
    if measurements["volume_iqr_db"] is not None:
        observations.append(f"有声附近的录音电平四分位差为 {measurements['volume_iqr_db']:.1f} dB，描述本次音量变化，不是环境声压。")
    if phoneme_assessment and phoneme_assessment["status"] == "tentative":
        predicted = " ".join(phoneme_assessment["predicted"] or [])
        observations.append(f"音素模型的试验性假设为 /{predicted}/；请与目标序列对照，不把它当作标准答案。")
    return observations
