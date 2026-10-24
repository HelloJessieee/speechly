import { useCallback, useEffect, useRef, useState } from 'react'

export type DeviceStatus =
  | 'not-requested'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'not-found'
  | 'unsupported'
  | 'error'

export interface MediaCaptureState {
  stream: MediaStream | null
  camera: DeviceStatus
  microphone: DeviceStatus
  errorMessage: string | null
  start: () => Promise<void>
  stop: () => void
}

function classify(error: unknown): DeviceStatus {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'not-found'
  return 'error'
}

const VIDEO: MediaTrackConstraints = { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true }

/**
 * Requests camera and microphone access only when `start` is called. Falls
 * back to whichever device is available, so a laptop without a camera can
 * still record audio. All tracks are stopped on `stop` and on unmount.
 */
export function useMediaCapture(): MediaCaptureState {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [camera, setCamera] = useState<DeviceStatus>('not-requested')
  const [microphone, setMicrophone] = useState<DeviceStatus>('not-requested')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
    setCamera('not-requested')
    setMicrophone('not-requested')
    setErrorMessage(null)
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported')
      setMicrophone('unsupported')
      setErrorMessage(
        window.isSecureContext
          ? 'This browser does not support camera and microphone access.'
          : 'Camera and microphone access requires a secure connection (https or localhost).',
      )
      return
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    setCamera('requesting')
    setMicrophone('requesting')
    setErrorMessage(null)

    let result: MediaStream | null = null
    let combinedError: unknown = null
    try {
      result = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: AUDIO })
    } catch (error) {
      combinedError = error
    }

    if (result) {
      streamRef.current = result
      setStream(result)
      setCamera(result.getVideoTracks().length ? 'ready' : 'not-found')
      setMicrophone(result.getAudioTracks().length ? 'ready' : 'not-found')
      return
    }

    const status = classify(combinedError)
    if (status === 'denied') {
      setCamera('denied')
      setMicrophone('denied')
      setErrorMessage('Permission was denied. You can allow access in your browser’s site settings, or continue in demo mode.')
      return
    }

    // One of the devices may be missing. Try each separately.
    const [audioOnly, videoOnly] = await Promise.allSettled([
      navigator.mediaDevices.getUserMedia({ audio: AUDIO }),
      navigator.mediaDevices.getUserMedia({ video: VIDEO }),
    ])
    const tracks: MediaStreamTrack[] = []
    if (audioOnly.status === 'fulfilled') tracks.push(...audioOnly.value.getTracks())
    if (videoOnly.status === 'fulfilled') tracks.push(...videoOnly.value.getTracks())
    setMicrophone(audioOnly.status === 'fulfilled' ? 'ready' : classify(audioOnly.reason))
    setCamera(videoOnly.status === 'fulfilled' ? 'ready' : classify(videoOnly.reason))

    if (tracks.length === 0) {
      setErrorMessage('No camera or microphone was found. Connect a device and try again, or continue in demo mode.')
      return
    }
    const merged = new MediaStream(tracks)
    streamRef.current = merged
    setStream(merged)
  }, [])

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  return { stream, camera, microphone, errorMessage, start, stop }
}
