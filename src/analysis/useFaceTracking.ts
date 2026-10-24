import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState } from 'react'
import { describeFrame, type Point3 } from './features'
import { LOWER_IN, LOWER_OUT, UPPER_IN, UPPER_OUT } from './landmarks'
import type { CapturedFrame } from './summarize'

export type TrackingStatus = 'off' | 'loading' | 'ready' | 'error'

export interface FaceTracking {
  status: TrackingStatus
  /** Whether a face is currently in view (updated a few times per second). */
  faceFound: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  overlayRef: React.RefObject<HTMLCanvasElement | null>
  beginCapture: () => void
  endCapture: () => CapturedFrame[]
}

const BASE = import.meta.env.BASE_URL
const MIN_FRAME_INTERVAL_MS = 50
const CROP_WIDTH = 240
const CROP_HEIGHT = 180

let landmarkerPromise: Promise<FaceLandmarker> | null = null

/** Loads the face landmarker once from the locally bundled model and WASM files. */
function loadLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks(`${BASE}mediapipe/wasm`)
    // The CPU (XNNPACK) delegate starts in about a second and keeps each frame
    // short. The GPU delegate blocked the page for seconds while compiling
    // shaders on machines without a fast GPU, which froze the interface.
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${BASE}mediapipe/face_landmarker.task`, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    })
  })()
  landmarkerPromise.catch(() => {
    landmarkerPromise = null
  })
  return landmarkerPromise
}

/**
 * Tracks the face in the camera preview with MediaPipe, entirely in the
 * browser. While capturing, it stores lip measurements and a small mouth-only
 * crop per frame. Nothing leaves the device unless the learner later asks for
 * Claude feedback.
 */
export function useFaceTracking(active: boolean): FaceTracking {
  // 'off' is derived from `active`; the state tracks loading progress while active.
  const [status, setStatus] = useState<Exclude<TrackingStatus, 'off'>>('loading')
  const [faceFound, setFaceFound] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const captureRef = useRef<{ startedAt: number; frames: CapturedFrame[] } | null>(null)
  const faceFoundRef = useRef(false)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const overlay = overlayRef.current
    let frame = 0
    let lastRun = 0
    let lastVideoTime = -1
    let lastFaceUpdate = 0
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = CROP_WIDTH
    cropCanvas.height = CROP_HEIGHT
    const cropContext = cropCanvas.getContext('2d')

    loadLandmarker()
      .then((landmarker) => {
        if (cancelled) return
        setStatus('ready')
        const tick = (now: number) => {
          frame = requestAnimationFrame(tick)
          const video = videoRef.current
          if (!video || video.readyState < 2 || video.videoWidth === 0) return
          if (now - lastRun < MIN_FRAME_INTERVAL_MS || video.currentTime === lastVideoTime) return
          lastRun = now
          lastVideoTime = video.currentTime

          const result = landmarker.detectForVideo(video, now)
          const raw = result.faceLandmarks[0]
          const w = video.videoWidth
          const h = video.videoHeight
          const mesh: Point3[] | null = raw ? raw.map((p) => ({ x: p.x * w, y: p.y * h, z: p.z * w })) : null

          drawOverlay(overlayRef.current, mesh, w, h)

          const found = mesh !== null
          if (found !== faceFoundRef.current && now - lastFaceUpdate > 300) {
            faceFoundRef.current = found
            lastFaceUpdate = now
            setFaceFound(found)
          }

          const capture = captureRef.current
          if (capture) {
            const features = mesh ? describeFrame(mesh) : null
            const crop = mesh && features && cropContext ? cropMouth(video, mesh, cropCanvas, cropContext) : null
            capture.frames.push({ t: (now - capture.startedAt) / 1000, features, crop })
          }
        }
        frame = requestAnimationFrame(tick)
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      captureRef.current = null
      faceFoundRef.current = false
      setFaceFound(false)
      setStatus('loading')
      overlay?.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height)
    }
  }, [active])

  const beginCapture = useCallback(() => {
    captureRef.current = { startedAt: performance.now(), frames: [] }
  }, [])

  const endCapture = useCallback(() => {
    const frames = captureRef.current?.frames ?? []
    captureRef.current = null
    return frames
  }, [])

  return { status: active ? status : 'off', faceFound: active && faceFound, videoRef, overlayRef, beginCapture, endCapture }
}

function drawOverlay(canvas: HTMLCanvasElement | null, mesh: Point3[] | null, w: number, h: number) {
  if (!canvas) return
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, w, h)
  if (!mesh) return
  context.lineWidth = Math.max(2, w / 260)
  context.lineJoin = 'round'
  context.strokeStyle = 'rgba(214, 234, 219, 0.95)'
  context.shadowColor = 'rgba(29, 59, 44, 0.6)'
  context.shadowBlur = 4
  for (const [top, bottom] of [
    [UPPER_OUT, LOWER_OUT],
    [UPPER_IN, LOWER_IN],
  ]) {
    context.beginPath()
    const loop = [...top, ...[...bottom].reverse()]
    loop.forEach((index, i) => (i === 0 ? context.moveTo(mesh[index].x, mesh[index].y) : context.lineTo(mesh[index].x, mesh[index].y)))
    context.closePath()
    context.stroke()
  }
}

/** Crops a 4:3 region around the mouth (nose base to chin) into a small JPEG. */
function cropMouth(video: HTMLVideoElement, mesh: Point3[], canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): string {
  const left = mesh[61]
  const right = mesh[291]
  const cx = (left.x + right.x) / 2
  const cy = (mesh[13].y + mesh[14].y) / 2
  const mouthWidth = Math.hypot(right.x - left.x, right.y - left.y)
  const sw = mouthWidth * 2.1
  const sh = sw * (CROP_HEIGHT / CROP_WIDTH)
  context.drawImage(video, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, CROP_WIDTH, CROP_HEIGHT)
  return canvas.toDataURL('image/jpeg', 0.72)
}
