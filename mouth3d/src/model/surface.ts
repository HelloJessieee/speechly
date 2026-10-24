import type { MouthParams } from './shapes'

// Pure math for the 3D mouth: contours of the lips and the depth of the skin,
// all as functions of the same MouthParams that drive the 2D illustration.
//
// Coordinates: 1 unit = 100 SVG units. The origin is the mouth center at rest,
// +x is the learner's right on screen, +y is up and +z points out of the face
// toward the viewer.

export const SVG_TO_3D = 1 / 100

/** MouthParams plus the one thing a front view cannot show: lips pushing forward. */
export interface Mouth3DParams extends MouthParams {
  /** 0–1: how far the lips push forward (rounded vowels, /w/, "oo"). */
  protrusion: number
}

/**
 * Until the shared SHAPES table gets its own protrusion values, derive one from
 * roundness: only clearly rounded shapes push the lips forward.
 */
export function deriveProtrusion(p: MouthParams): number {
  return Math.min(1, Math.max(0, (p.round - 0.3) / 0.7))
}

export function to3DParams(p: MouthParams, protrusion?: number): Mouth3DParams {
  return { ...p, protrusion: protrusion ?? deriveProtrusion(p) }
}

/**
 * Lip contours sampled at t ∈ [-1, 1], from the left corner (-1) to the right
 * one (1). Every y is in 3D units.
 */
export interface LipContours {
  halfWidth: number
  centerY: number
  innerTop: (t: number) => number
  innerBottom: (t: number) => number
  outerTop: (t: number) => number
  outerBottom: (t: number) => number
  /** Thickness of each lip at t (outer edge to inner edge). */
  upperThickness: (t: number) => number
  lowerThickness: (t: number) => number
  /** How far the lips sit in front of the resting skin at t. */
  forward: (t: number) => number
  /** Extra forward fullness of the lip body when the lips push out. */
  fullness: (t: number) => number
  /** Extra backward shift of the lower lip for /f/. */
  lowerBack: number
}

export function lipContours(p: Mouth3DParams): LipContours {
  const s = SVG_TO_3D
  const hw = p.halfWidth * s
  // Matches buildMouth: for /f/ the whole opening rises slightly.
  const cy = p.tuck * 4 * s
  // A round opening is an ellipse; a flat one is a lens with pointed corners.
  const openExp = 0.5 + 0.5 * (1 - p.round)
  const halfOpen = (t: number) => ((p.open * s) / 2) * Math.pow(Math.max(0, 1 - t * t), openExp)
  // Cupid's bow: a dip at the center between two soft peaks. Rounding softens it.
  const bow = 1 - p.round * 0.6
  const bowShape = (t: number) =>
    1 - 0.26 * bow * Math.exp(-((t / 0.12) ** 2)) + 0.1 * bow * Math.exp(-(((Math.abs(t) - 0.3) / 0.14) ** 2))
  // Low exponents keep the lips plump almost all the way to the corners.
  const upperThickness = (t: number) => p.upperThickness * s * Math.pow(Math.max(0, 1 - t * t), 0.35) * bowShape(t)
  const lowerThickness = (t: number) => p.lowerThickness * s * Math.pow(Math.max(0, 1 - t * t), 0.4)
  const innerTop = (t: number) => cy + halfOpen(t)
  const innerBottom = (t: number) => cy - halfOpen(t)

  return {
    halfWidth: hw,
    centerY: cy,
    innerTop,
    innerBottom,
    outerTop: (t) => innerTop(t) + upperThickness(t),
    outerBottom: (t) => innerBottom(t) - lowerThickness(t),
    upperThickness,
    lowerThickness,
    forward: (t) => p.protrusion * 0.34 * Math.pow(Math.max(0, 1 - t * t), 0.7),
    fullness: (t) => p.protrusion * 0.14 * Math.sqrt(Math.max(0, 1 - t * t)),
    lowerBack: p.tuck * 0.12,
  }
}

const gauss = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  Math.exp(-(((x - cx) / rx) ** 2) - ((y - cy) / ry) ** 2)

/** Resting depth of the skin at (x, y): a rounded head with a muzzle, nose base and chin. */
export function skinDepth(x: number, y: number): number {
  const head = 1.25 * Math.sqrt(Math.max(0.02, 1 - (x / 2.05) ** 2 - ((y - 0.35) / 2.6) ** 2))
  // The area over the teeth bulges forward.
  const muzzle = 0.28 * gauss(x, y, 0, 0, 0.95, 0.84)
  // A small, round button nose with soft nostril wings.
  const nose = 0.36 * gauss(x, y, 0, 1.42, 0.24, 0.24) + 0.08 * (gauss(x, y, -0.2, 1.3, 0.13, 0.12) + gauss(x, y, 0.2, 1.3, 0.13, 0.12))
  const chin = 0.13 * gauss(x, y, 0, -1.05, 0.55, 0.3)
  // The fold between lower lip and chin.
  const fold = -0.05 * gauss(x, y, 0, -0.6, 0.5, 0.12)
  // Two faint philtrum ridges.
  const philtrum = 0.012 * (gauss(x, y, -0.09, 0.62, 0.03, 0.22) + gauss(x, y, 0.09, 0.62, 0.03, 0.22))
  return head + muzzle + nose + chin + fold + philtrum
}

/** Outline of the visible lower face: an ellipse cut flat just under the eyes. */
export const FACE_OUTLINE = { cy: 0.72, rx: 1.78, ry: 2.14, top: 1.8 }

/**
 * 0–1 opacity of the skin at fraction s of the way from the lips to the outline,
 * so the face fades softly into the background instead of ending at a hard edge.
 */
export function skinOpacity(s: number): number {
  const u = Math.min(1, Math.max(0, (s - 0.84) / 0.16))
  return 1 - u * u * (3 - 2 * u)
}

/** 0–1 amount of rosy blush on the cheeks at (x, y). */
export function blush(x: number, y: number): number {
  return 0.55 * (gauss(x, y, -1.0, 0.45, 0.36, 0.3) + gauss(x, y, 1.0, 0.45, 0.36, 0.3))
}

/** Where a ray from the mouth center in direction (dx, dy) leaves the face outline. */
export function faceBoundary(dx: number, dy: number): { x: number; y: number } {
  const { cy, rx, ry, top } = FACE_OUTLINE
  const a = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
  const b = (-2 * cy * dy) / (ry * ry)
  const c = (cy * cy) / (ry * ry) - 1
  let k = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
  if (k * dy > top) k = top / dy
  return { x: k * dx, y: k * dy }
}
