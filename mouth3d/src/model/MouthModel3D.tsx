import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react'
import type { Mouth3DParams } from './surface'
import { MouthViewer, type ViewName } from './viewer'

export interface MouthModel3DHandle {
  goTo: (view: ViewName) => void
}

interface MouthModel3DProps {
  params: Mouth3DParams
  label: string
  wireframe?: boolean
  onViewChange?: (azimuth: number, elevation: number) => void
}

const KEY_STEP = 0.18

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/**
 * Draggable 3D view of the mouth. Drag (or use the arrow keys) to turn it,
 * scroll or pinch to zoom. Renders a short message instead when WebGL is
 * unavailable, so callers can keep the 2D illustration alongside.
 */
export const MouthModel3D = forwardRef<MouthModel3DHandle, MouthModel3DProps>(function MouthModel3D(
  { params, label, wireframe = false, onViewChange },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<MouthViewer | null>(null)
  const [failed] = useState(() => !hasWebGL())
  const onViewChangeRef = useRef(onViewChange)
  useEffect(() => {
    onViewChangeRef.current = onViewChange
  }, [onViewChange])

  useEffect(() => {
    if (!hostRef.current || failed) return
    let viewer: MouthViewer
    try {
      viewer = new MouthViewer(hostRef.current)
    } catch {
      return
    }
    viewer.onViewChange = (a, e) => onViewChangeRef.current?.(a, e)
    viewerRef.current = viewer
    return () => {
      viewer.dispose()
      viewerRef.current = null
    }
  }, [failed])

  // Declared after the setup effect so it also runs on mount, once the viewer exists.
  useEffect(() => {
    viewerRef.current?.setParams(params)
  }, [params])

  useEffect(() => {
    viewerRef.current?.setWireframe(wireframe)
  }, [wireframe])

  useImperativeHandle(ref, () => ({ goTo: (view) => viewerRef.current?.goTo(view) }), [])

  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    }
    const step = steps[event.key]
    if (step) {
      event.preventDefault()
      viewerRef.current?.rotateBy(step[0], step[1])
    } else if (event.key === 'Home') {
      event.preventDefault()
      viewerRef.current?.goTo('front')
    }
  }

  if (failed) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-ink-soft">
        3D view needs WebGL, which this browser has turned off.
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={`${label}. Drag or use the arrow keys to turn the model; Home returns to the front.`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      data-testid="mouth-3d"
    />
  )
})
