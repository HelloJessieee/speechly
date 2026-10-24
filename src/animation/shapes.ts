import type { Keyframe, MouthShapeId } from '../types'

/**
 * Numeric description of a visible mouth state. Every value is in SVG user
 * units (viewBox 0 0 400 300) except where noted. Interpolating between two
 * sets of parameters gives smooth transitions between shapes.
 */
export interface MouthParams {
  /** Vertical gap between the inner lip edges at the center. */
  open: number
  /** Distance from the center to each mouth corner. */
  halfWidth: number
  upperThickness: number
  lowerThickness: number
  /** 0–1: how much of the upper teeth is visible. */
  upperTeeth: number
  /** 0–1: how much of the lower teeth is visible. */
  lowerTeeth: number
  /** 0–1: lower lip rises to meet the upper teeth (as in /f/). */
  tuck: number
  /** 0–1: how round (rather than wide and flat) the opening looks. */
  round: number
}

export const SHAPES: Record<MouthShapeId, MouthParams> = {
  rest: { open: 3, halfWidth: 70, upperThickness: 15, lowerThickness: 19, upperTeeth: 0, lowerTeeth: 0, tuck: 0, round: 0.2 },
  closed: { open: 0, halfWidth: 68, upperThickness: 14, lowerThickness: 17, upperTeeth: 0, lowerTeeth: 0, tuck: 0, round: 0.15 },
  open: { open: 34, halfWidth: 62, upperThickness: 13, lowerThickness: 17, upperTeeth: 0.7, lowerTeeth: 0.35, tuck: 0, round: 0.5 },
  spread: { open: 13, halfWidth: 86, upperThickness: 11, lowerThickness: 14, upperTeeth: 0.85, lowerTeeth: 0.5, tuck: 0, round: 0.1 },
  rounded: { open: 22, halfWidth: 38, upperThickness: 19, lowerThickness: 22, upperTeeth: 0.15, lowerTeeth: 0, tuck: 0, round: 1 },
  lipTeeth: { open: 6, halfWidth: 72, upperThickness: 14, lowerThickness: 14, upperTeeth: 1, lowerTeeth: 0, tuck: 1, round: 0.25 },
  teethTogether: { open: 11, halfWidth: 82, upperThickness: 11, lowerThickness: 14, upperTeeth: 1, lowerTeeth: 1, tuck: 0, round: 0.1 },
}

export const SHAPE_LABELS: Record<MouthShapeId, string> = {
  rest: 'Rest',
  closed: 'Closed lips',
  open: 'Open mouth',
  spread: 'Spread lips',
  rounded: 'Rounded lips',
  lipTeeth: 'Lower lip to upper teeth',
  teethTogether: 'Teeth close, lips spread',
}

export function lerpParams(a: MouthParams, b: MouthParams, t: number): MouthParams {
  const mix = (x: number, y: number) => x + (y - x) * t
  return {
    open: mix(a.open, b.open),
    halfWidth: mix(a.halfWidth, b.halfWidth),
    upperThickness: mix(a.upperThickness, b.upperThickness),
    lowerThickness: mix(a.lowerThickness, b.lowerThickness),
    upperTeeth: mix(a.upperTeeth, b.upperTeeth),
    lowerTeeth: mix(a.lowerTeeth, b.lowerTeeth),
    tuck: mix(a.tuck, b.tuck),
    round: mix(a.round, b.round),
  }
}

const easeInOut = (t: number) => t * t * (3 - 2 * t)

export interface TimelineSample {
  params: MouthParams
  /** Index of the keyframe whose caption describes the current movement. */
  stepIndex: number
}

/** Sample a timeline at `time` ms, smoothly interpolating between keyframes. */
export function sampleTimeline(timeline: Keyframe[], time: number): TimelineSample {
  if (timeline.length === 0) return { params: SHAPES.rest, stepIndex: 0 }
  if (time <= timeline[0].at) return { params: SHAPES[timeline[0].shape], stepIndex: 0 }
  for (let i = 0; i < timeline.length - 1; i++) {
    const a = timeline[i]
    const b = timeline[i + 1]
    if (time <= b.at) {
      const u = easeInOut((time - a.at) / Math.max(1, b.at - a.at))
      return { params: lerpParams(SHAPES[a.shape], SHAPES[b.shape], u), stepIndex: i + 1 }
    }
  }
  const last = timeline.length - 1
  return { params: SHAPES[timeline[last].shape], stepIndex: last }
}

// ---------------------------------------------------------------------------
// Geometry

export const MOUTH_CENTER = { x: 200, y: 168 }

export interface MouthGeometry {
  left: { x: number; y: number }
  right: { x: number; y: number }
  innerTopY: number
  innerBottomY: number
  outerTopY: number
  outerBottomY: number
  upperLip: string
  lowerLip: string
  interior: string
  /** Interior extended downward so the upper teeth can overlap the lower lip. */
  upperTeethClip: string
  upperTeeth: { x: number; y: number; width: number; height: number }
  lowerTeeth: { x: number; y: number; width: number; height: number }
  lipLine: string
  outline: string
}

const f = (n: number) => n.toFixed(2)

export function buildMouth(p: MouthParams): MouthGeometry {
  const { x: cx } = MOUTH_CENTER
  // For /f/ the whole opening rises slightly as the lower lip lifts.
  const cy = MOUTH_CENTER.y - p.tuck * 4
  const hw = p.halfWidth
  const L = { x: cx - hw, y: cy }
  const R = { x: cx + hw, y: cy }
  const innerTopY = cy - p.open / 2
  const innerBottomY = cy + p.open / 2
  // A cubic whose two control points share a y value reaches 3/4 of the way
  // to them at its midpoint, so scale by 4/3 to land exactly on the target.
  const ctrlY = (target: number) => cy + (target - cy) * (4 / 3)
  const kx = hw * (0.42 + p.round * 0.45)

  const innerTop = `C ${f(cx - kx)} ${f(ctrlY(innerTopY))} ${f(cx + kx)} ${f(ctrlY(innerTopY))} ${f(R.x)} ${f(R.y)}`
  const innerTopReverse = `C ${f(cx + kx)} ${f(ctrlY(innerTopY))} ${f(cx - kx)} ${f(ctrlY(innerTopY))} ${f(L.x)} ${f(L.y)}`
  const innerBottomReverse = (y: number) =>
    `C ${f(cx + kx)} ${f(ctrlY(y))} ${f(cx - kx)} ${f(ctrlY(y))} ${f(L.x)} ${f(L.y)}`

  const outerTopY = innerTopY - p.upperThickness
  const bowDip = 3.5 * (1 - p.round * 0.6)
  const upperLip = [
    `M ${f(L.x)} ${f(L.y)}`,
    `C ${f(L.x + hw * 0.25)} ${f(cy - p.upperThickness * 0.7 - p.open * 0.35)} ${f(cx - hw * 0.55)} ${f(outerTopY)} ${f(cx - hw * 0.28)} ${f(outerTopY)}`,
    `Q ${f(cx - hw * 0.1)} ${f(outerTopY)} ${f(cx)} ${f(outerTopY + bowDip)}`,
    `Q ${f(cx + hw * 0.1)} ${f(outerTopY)} ${f(cx + hw * 0.28)} ${f(outerTopY)}`,
    `C ${f(cx + hw * 0.55)} ${f(outerTopY)} ${f(R.x - hw * 0.25)} ${f(cy - p.upperThickness * 0.7 - p.open * 0.35)} ${f(R.x)} ${f(R.y)}`,
    innerTopReverse,
    'Z',
  ].join(' ')

  const outerBottomY = innerBottomY + p.lowerThickness
  const innerBottom = `C ${f(cx - kx)} ${f(ctrlY(innerBottomY))} ${f(cx + kx)} ${f(ctrlY(innerBottomY))} ${f(R.x)} ${f(R.y)}`
  const lowerLip = [
    `M ${f(L.x)} ${f(L.y)}`,
    innerBottom,
    `C ${f(cx + hw * 0.62)} ${f(ctrlY(outerBottomY))} ${f(cx - hw * 0.62)} ${f(ctrlY(outerBottomY))} ${f(L.x)} ${f(L.y)}`,
    'Z',
  ].join(' ')

  const interior = `M ${f(L.x)} ${f(L.y)} ${innerTop} ${innerBottomReverse(innerBottomY)} Z`
  const upperTeethClip = `M ${f(L.x)} ${f(L.y)} ${innerTop} ${innerBottomReverse(innerBottomY + p.tuck * 13)} Z`

  const teethWidth = hw * 1.3
  const upperTeethHeight = (15 + p.tuck * 3) * p.upperTeeth
  const lowerTeethHeight = 10 * p.lowerTeeth

  const outline = [
    `M ${f(L.x)} ${f(L.y)}`,
    `C ${f(L.x + hw * 0.25)} ${f(cy - p.upperThickness * 0.7 - p.open * 0.35)} ${f(cx - hw * 0.55)} ${f(outerTopY)} ${f(cx - hw * 0.28)} ${f(outerTopY)}`,
    `Q ${f(cx - hw * 0.1)} ${f(outerTopY)} ${f(cx)} ${f(outerTopY + bowDip)}`,
    `Q ${f(cx + hw * 0.1)} ${f(outerTopY)} ${f(cx + hw * 0.28)} ${f(outerTopY)}`,
    `C ${f(cx + hw * 0.55)} ${f(outerTopY)} ${f(R.x - hw * 0.25)} ${f(cy - p.upperThickness * 0.7 - p.open * 0.35)} ${f(R.x)} ${f(R.y)}`,
    `C ${f(cx + hw * 0.62)} ${f(ctrlY(outerBottomY))} ${f(cx - hw * 0.62)} ${f(ctrlY(outerBottomY))} ${f(L.x)} ${f(L.y)}`,
    'Z',
  ].join(' ')

  return {
    left: L,
    right: R,
    innerTopY,
    innerBottomY,
    outerTopY,
    outerBottomY,
    upperLip,
    lowerLip,
    interior,
    upperTeethClip,
    upperTeeth: { x: cx - teethWidth / 2, y: innerTopY - 2, width: teethWidth, height: upperTeethHeight + 2 },
    lowerTeeth: { x: cx - teethWidth / 2, y: innerBottomY - lowerTeethHeight, width: teethWidth, height: lowerTeethHeight + 2 },
    lipLine: `M ${f(L.x)} ${f(L.y)} ${innerTop}`,
    outline,
  }
}
