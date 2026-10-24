import { CHEEK_L, CHEEK_R, CHIN, LOWER_IN, LOWER_OUT, UPPER_IN, UPPER_OUT } from './landmarks'

// Per-frame lip measurements in the face's own coordinate frame, so they do
// not change with head position, in-plane rotation or distance to the camera.
//
// The face-frame construction and the trimming below are ported from
// lipreading/personal/reader.py in
// https://github.com/cdiazcastilla/lip-reading-research (MIT licence).

export interface Point3 {
  x: number
  y: number
  z: number
}

export interface FrameFeatures {
  /** Inner-lip opening at the center / face width. */
  opening: number
  /** Mouth-corner distance / face width. */
  width: number
  /** Visible lower-lip thickness at the center / face width. */
  lowerLip: number
  /** Outer-lip depth relative to the chin, in face widths (positive = forward). */
  protrusion: number
}

const mean = (points: Point3[]) => {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length }
}

const dist = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Measures one frame. `mesh` holds the 478 landmarks with x and y already
 * scaled to pixels (MediaPipe normalizes x and y by different image sides,
 * which would distort distances on non-square frames).
 */
export function describeFrame(mesh: Point3[]): FrameFeatures | null {
  if (mesh.length < 468) return null
  const pick = (indices: number[]) => indices.map((i) => mesh[i])
  const upperOut = pick(UPPER_OUT)
  const upperIn = pick(UPPER_IN)
  const lowerOut = pick(LOWER_OUT)
  const lowerIn = pick(LOWER_IN)
  const chin = pick(CHIN)

  // Face width: distance between the cheek centers. Distances are rotation
  // invariant, so only the scale needs removing here.
  const scale = dist(mean(pick(CHEEK_L)), mean(pick(CHEEK_R)))
  if (!(scale > 1e-6)) return null

  const outer = [...upperOut, ...lowerOut.slice(1, 10)]
  // MediaPipe z grows away from the camera, so forward lips have smaller z.
  const protrusion = -(mean(outer).z - mean(chin).z) / scale

  const features: FrameFeatures = {
    opening: dist(upperIn[5], lowerIn[5]) / scale,
    width: dist(upperOut[0], upperOut[10]) / scale,
    lowerLip: dist(lowerIn[5], lowerOut[5]) / scale,
    protrusion,
  }
  return Object.values(features).every(Number.isFinite) ? features : null
}

const shrinkingAverage = (values: number[], half = 2) =>
  values.map((_, i) => {
    const window = values.slice(Math.max(0, i - half), i + half + 1)
    return window.reduce((a, b) => a + b, 0) / window.length
  })

/**
 * First and last frame of visible speech movement, from mouth opening, width
 * and their motion. Returns null when no clear movement is found.
 */
export function trimRange(opening: number[], width: number[], k = 0.15, pad = 3): [number, number] | null {
  const n = opening.length
  if (n < 8) return null
  const sortedWidth = [...width].sort((a, b) => a - b)
  const medianWidth = sortedWidth[Math.floor(n / 2)]
  const minOpening = Math.min(...opening)
  const motion = opening.map((value, i) => (i === 0 ? 0 : Math.abs(value - opening[i - 1]) + 0.7 * Math.abs(width[i] - width[i - 1])))
  const offset = opening.map((value, i) => value - minOpening + 0.5 * Math.abs(width[i] - medianWidth))
  const smoothOffset = shrinkingAverage(offset)
  const smoothMotion = shrinkingAverage(motion)
  const activity = smoothOffset.map((value, i) => value + 3 * smoothMotion[i])
  const lo = Math.min(...activity)
  const hi = Math.max(...activity)
  if (!(hi - lo > 1e-9)) return null
  const active = activity.flatMap((value, i) => (value > lo + k * (hi - lo) ? [i] : []))
  if (active.length === 0 || active[active.length - 1] - active[0] < 6) return null
  return [Math.max(0, active[0] - pad), Math.min(n - 1, active[active.length - 1] + pad)]
}
