// Mouth shape ids and timeline keyframes, copied from the original app's
// src/types.ts so this folder does not depend on it.

/** Reusable, visible mouth states. */
export type MouthShapeId = 'rest' | 'closed' | 'open' | 'spread' | 'rounded' | 'lipTeeth' | 'teethTogether'

/** A point on an authored animation timeline. */
export interface Keyframe {
  /** Milliseconds from the start of the timeline at normal speed. */
  at: number
  shape: MouthShapeId
  /** Short caption shown while this keyframe is the most recent one. */
  caption: string
  /** Optional sound label, e.g. "/m/". */
  sound?: string
}
