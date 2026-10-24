import { useEffect, useRef } from 'react'
import type { DeviceStatus } from '../media/useMediaCapture'
import { Icon } from './Icon'
import { StatusPill } from './StatusPill'

export type PracticeMode = 'off' | 'live' | 'demo'

interface CameraPreviewProps {
  mode: PracticeMode
  stream: MediaStream | null
  camera: DeviceStatus
  microphone: DeviceStatus
  errorMessage: string | null
  onStart: () => void
  onDemo: () => void
  onStop: () => void
}

/** Mirrored camera preview with a simple positioning guide. */
export function CameraPreview({ mode, stream, camera, microphone, errorMessage, onStart, onDemo, onStop }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasVideo = camera === 'ready' && (stream?.getVideoTracks().length ?? 0) > 0
  const requesting = camera === 'requesting' || microphone === 'requesting'
  const failed = mode === 'live' && !requesting && !stream

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = hasVideo ? stream : null
    if (hasVideo) void video.play().catch(() => {})
  }, [stream, hasVideo])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-white/30 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.7),inset_0_2px_12px_rgb(29_59_44/0.06)] ring-1 ring-line">
        {hasVideo && (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              aria-label="Your camera preview, mirrored"
              className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
            />
            <svg viewBox="0 0 400 300" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <ellipse cx="200" cy="140" rx="92" ry="118" fill="none" stroke="#fffdf9" strokeWidth="3" strokeDasharray="8 7" opacity="0.9" />
              <path d="M165 192 Q200 210 235 192" fill="none" stroke="#fffdf9" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            </svg>
            <p className="absolute inset-x-3 bottom-3 rounded-full bg-ink/75 px-3 py-1.5 text-center text-sm font-semibold text-white">
              Center your face in the oval, with your mouth near the curve.
            </p>
          </>
        )}

        {!hasVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center">
            {mode === 'off' && (
              <>
                <span className="glass rounded-full p-3 text-sage">
                  <Icon name="camera" className="size-7" />
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className="btn-primary" onClick={onStart}>
                    <Icon name="camera" /> Start camera &amp; microphone
                  </button>
                  <button type="button" className="btn-secondary" onClick={onDemo}>
                    Try demo mode
                  </button>
                </div>
                <p className="text-xs text-ink-soft">Recordings stay in this browser tab.</p>
              </>
            )}

            {mode === 'live' && requesting && (
              <>
                <span className="mc-pulse rounded-full bg-paper p-3 text-sky">
                  <Icon name="camera" className="size-7" />
                </span>
                <p className="font-semibold" role="status">
                  Waiting for camera and microphone permission…
                </p>
              </>
            )}

            {failed && (
              <div role="alert" className="flex flex-col items-center gap-3">
                <p className="max-w-sm font-semibold">{errorMessage ?? 'Camera and microphone are unavailable.'}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className="btn-primary" onClick={onDemo}>
                    Try demo mode
                  </button>
                  <button type="button" className="btn-secondary" onClick={onStart}>
                    Try again
                  </button>
                </div>
              </div>
            )}

            {mode === 'live' && !requesting && stream && (
              <>
                <span className="rounded-full bg-paper p-3 text-sage">
                  <Icon name="mic" className="size-7" />
                </span>
                <p className="max-w-xs font-semibold">
                  {camera === 'denied' ? 'Camera permission was denied.' : 'No camera was found.'} Audio recording still works.
                </p>
              </>
            )}

            {mode === 'demo' && (
              <>
                <svg viewBox="0 0 120 100" className="w-28" aria-hidden="true">
                  <ellipse cx="60" cy="50" rx="34" ry="44" fill="#fffdf9" stroke="#3f7d5c" strokeWidth="2.5" strokeDasharray="5 5" />
                  <path d="M46 66 Q60 74 74 66" fill="none" stroke="#3f7d5c" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <p className="font-bold">Demo mode — camera and microphone are off</p>
                <button type="button" className="btn-secondary" onClick={onStart}>
                  <Icon name="camera" /> Use my camera instead
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mode === 'live' && (
          <>
            <StatusPill device="Camera" status={camera} />
            <StatusPill device="Microphone" status={microphone} />
          </>
        )}
        {mode !== 'off' && (
          <button type="button" className="btn-quiet ml-auto min-h-9 px-3 text-sm" onClick={onStop}>
            <Icon name="power" className="size-4" />
            {mode === 'demo' ? 'Exit demo mode' : 'Turn off camera & mic'}
          </button>
        )}
      </div>
    </div>
  )
}
