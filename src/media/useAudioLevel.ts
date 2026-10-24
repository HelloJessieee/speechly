import { useEffect, useRef, useState } from 'react'

/**
 * Measures the live microphone signal level (0–1) using an AnalyserNode.
 * This is a loudness measurement only and says nothing about pronunciation.
 */
export function useAudioLevel(stream: MediaStream | null): { level: number; levelRef: React.RefObject<number> } {
  const [level, setLevel] = useState(0)
  const levelRef = useRef(0)

  useEffect(() => {
    const audioTracks = stream?.getAudioTracks() ?? []
    if (!stream || audioTracks.length === 0 || typeof AudioContext === 'undefined') {
      levelRef.current = 0
      return
    }
    const context = new AudioContext()
    const source = context.createMediaStreamSource(new MediaStream(audioTracks))
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const data = new Float32Array(analyser.fftSize)
    let frame = 0
    let lastPaint = 0
    const tick = (now: number) => {
      analyser.getFloatTimeDomainData(data)
      let sum = 0
      for (const sample of data) sum += sample * sample
      const rms = Math.sqrt(sum / data.length)
      // Map roughly -60 dB … 0 dB onto 0 … 1.
      const db = 20 * Math.log10(Math.max(rms, 1e-6))
      const normalized = Math.max(0, Math.min(1, (db + 60) / 60))
      levelRef.current = normalized
      if (now - lastPaint > 50) {
        lastPaint = now
        setLevel(normalized)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      void context.close()
      levelRef.current = 0
      setLevel(0)
    }
  }, [stream])

  return { level, levelRef }
}
