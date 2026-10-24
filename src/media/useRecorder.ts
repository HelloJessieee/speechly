import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_RECORDING_MS = 10_000
/** Recordings shorter than this are treated as unusable. */
const MIN_RECORDING_MS = 400
/** Peak level (0–1) below which we warn that little sound was detected. */
const QUIET_THRESHOLD = 0.2

export type RecorderStatus = 'idle' | 'recording' | 'ready' | 'unusable' | 'error'

export interface Recording {
  /** Object URL of the captured audio, or null for a simulated demo attempt. */
  url: string | null
  durationMs: number
  peakLevel: number
  quiet: boolean
}

export interface RecorderState {
  status: RecorderStatus
  elapsedMs: number
  recording: Recording | null
  message: string | null
  canRecord: boolean
  start: () => void
  stop: () => void
  discard: () => void
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

/**
 * Records audio from the microphone tracks of `stream` into browser memory.
 * Object URLs are revoked on discard, on a new recording and on unmount.
 * Nothing is uploaded or persisted.
 */
export function useRecorder(stream: MediaStream | null, levelRef: React.RefObject<number>): RecorderState {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const peakRef = useRef(0)
  const urlRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const hasAudio = (stream?.getAudioTracks().length ?? 0) > 0
  const canRecord = hasAudio && typeof MediaRecorder !== 'undefined'

  const revoke = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  const stop = useCallback(() => {
    clearTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const start = useCallback(() => {
    if (!stream || !canRecord) return
    revoke()
    setRecording(null)
    setMessage(null)
    chunksRef.current = []
    peakRef.current = 0

    let recorder: MediaRecorder
    try {
      const mimeType = pickMimeType()
      recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()), mimeType ? { mimeType } : undefined)
    } catch {
      setStatus('error')
      setMessage('Recording is not supported in this browser. You can continue in demo mode.')
      return
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      clearTimer()
      const durationMs = Math.min(MAX_RECORDING_MS, performance.now() - startedAtRef.current)
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      chunksRef.current = []
      recorderRef.current = null
      setElapsedMs(durationMs)
      if (blob.size === 0 || durationMs < MIN_RECORDING_MS) {
        setStatus('unusable')
        setMessage('That recording was too short or empty. Try recording for at least one second.')
        return
      }
      const url = URL.createObjectURL(blob)
      urlRef.current = url
      const peakLevel = peakRef.current
      const quiet = peakLevel < QUIET_THRESHOLD
      setRecording({ url, durationMs, peakLevel, quiet })
      setStatus('ready')
      setMessage(quiet ? 'Very little sound was detected. Check that your microphone is not muted, then try again.' : null)
    }

    recorderRef.current = recorder
    startedAtRef.current = performance.now()
    setElapsedMs(0)
    setStatus('recording')
    recorder.start(250)
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAtRef.current
      peakRef.current = Math.max(peakRef.current, levelRef.current ?? 0)
      setElapsedMs(Math.min(elapsed, MAX_RECORDING_MS))
      if (elapsed >= MAX_RECORDING_MS) stop()
    }, 100)
  }, [stream, canRecord, levelRef, stop])

  const discard = useCallback(() => {
    stop()
    revoke()
    setRecording(null)
    setElapsedMs(0)
    setMessage(null)
    setStatus('idle')
  }, [stop])

  // Stop recording if the stream goes away.
  useEffect(() => {
    if (!stream && recorderRef.current) stop()
  }, [stream, stop])

  useEffect(
    () => () => {
      clearTimer()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.stop()
      }
      revoke()
    },
    [],
  )

  return { status, elapsedMs, recording, message, canRecord, start, stop, discard }
}
