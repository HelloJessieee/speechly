import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_MS, type RecorderState, type RecorderStatus, type Recording } from './useRecorder'

/** A simulated attempt stops by itself after this long if the user does not stop it. */
const DEMO_AUTO_STOP_MS = 3_000

/**
 * Simulates the recorder without touching any device so the whole practice
 * flow can be explored without camera or microphone permission. It exposes
 * the same interface as `useRecorder`, but never captures audio.
 */
export function useDemoRecorder(): RecorderState {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [recording, setRecording] = useState<Recording | null>(null)
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  const stop = useCallback(() => {
    if (timerRef.current === null) return
    clearTimer()
    const durationMs = Math.max(800, performance.now() - startedAtRef.current)
    setElapsedMs(durationMs)
    setRecording({ url: null, durationMs, peakLevel: 0, quiet: false })
    setStatus('ready')
  }, [])

  const start = useCallback(() => {
    clearTimer()
    setRecording(null)
    startedAtRef.current = performance.now()
    setElapsedMs(0)
    setStatus('recording')
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAtRef.current
      setElapsedMs(Math.min(elapsed, MAX_RECORDING_MS))
      if (elapsed >= DEMO_AUTO_STOP_MS) stop()
    }, 100)
  }, [stop])

  const discard = useCallback(() => {
    clearTimer()
    setRecording(null)
    setElapsedMs(0)
    setStatus('idle')
  }, [])

  useEffect(() => clearTimer, [])

  return { status, elapsedMs, recording, message: null, canRecord: true, start, stop, discard }
}
