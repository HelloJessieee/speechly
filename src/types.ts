// Shared domain types. Lesson content, animation, media capture and feedback
// all exchange data through these structures so each layer can be replaced
// independently (for example, swapping the demo feedback provider for real
// audio analysis later).

export type LessonId = 'me' | 'moon' | 'fish' | 'pea' | 'bee' | 'see-me'

/** Reusable, visible mouth states used by the reference illustration. */
export type MouthShapeId =
  | 'rest'
  | 'closed'
  | 'open'
  | 'spread'
  | 'rounded'
  | 'lipTeeth'
  | 'teethTogether'

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

export type ActionId =
  | 'replay_reference'
  | 'practice_lip_closure'
  | 'practice_rounded_shape'
  | 'practice_lip_teeth_position'
  | 'record_again'

export type HighlightRegion = 'upperLip' | 'lowerLip' | 'bothLips' | 'corners'
export type ArrowDirection = 'close' | 'inward' | 'lowerLipUp' | 'spread'

export interface CorrectionGuide {
  actionId: ActionId
  /** One-sentence general practice suggestion. */
  instruction: string
  /** Timeline used in correction mode (slower, focused on the target shape). */
  timeline: Keyframe[]
  /** Shape drawn as a dashed target outline. */
  targetShape: MouthShapeId
  highlight?: HighlightRegion
  arrows?: ArrowDirection[]
}

export interface DemoFeedbackContent {
  /** First scripted attempt: a corrective suggestion. */
  suggestion: { practiceFocus: string; tip: string }
  /** Follow-up scripted attempt: how the UI would acknowledge a change. */
  acknowledgement: { practiceFocus: string; tip: string }
}

/** Visible movements that can be measured from face landmarks. */
export type VisualCheckId = 'closure' | 'rounding' | 'spread' | 'lipTeeth'

export interface Lesson {
  id: LessonId
  text: string
  /** Learner-friendly reference plus IPA. */
  pronunciation: { respelling: string; ipa: string }
  explanation: string
  target: { label: string; description: string }
  timeline: Keyframe[]
  tip: string
  /** Optional note that adds important context (e.g. limits of lip reading). */
  note?: string
  correction: CorrectionGuide
  demoFeedback: DemoFeedbackContent
  /** Movements the landmark analysis checks for this lesson. */
  visualChecks: VisualCheckId[]
}

export type AttemptSource = 'recording' | 'demo'

export interface PracticeAttempt {
  id: string
  lessonId: LessonId
  /** 1-based count of attempts for this lesson in the current session. */
  attemptNumber: number
  source: AttemptSource
  durationMs: number
  createdAt: number
  /**
   * Microphone signal measurement only. It describes how loud the input was,
   * never whether the word was pronounced correctly.
   */
  signal?: { peakLevel: number; usable: boolean }
  /** Lip measurements from face landmarks, when the camera was on. */
  analysis?: MouthAnalysis | null
}

// ---------------------------------------------------------------------------
// Mouth analysis (computed locally in the browser from face landmarks)

export type CheckResult = 'detected' | 'unclear' | 'not_detected'

export interface VisualCheck {
  id: VisualCheckId
  result: CheckResult
  /** Plain-language summary shown to the learner. */
  summary: string
  /** Seconds from the start of the recording, when relevant. */
  atSeconds?: number
  /** Raw measurement for the feedback provider (ratio to the learner's own rest shape, etc.). */
  value?: number
}

export interface MouthSample {
  /** Seconds from the start of the recording. */
  t: number
  /** Inner-lip opening / face width. */
  opening: number
  /** Mouth width relative to the learner's rest width (1 = rest). */
  width: number
  /** Visible lower-lip thickness relative to rest (lower = lip tucked in). */
  lowerLip: number
  /** Lip protrusion relative to rest, in face widths (positive = forward). */
  protrusion: number
}

export interface MouthSnapshot {
  label: string
  t: number
  /** JPEG data URL of a mouth-only crop (unmirrored). */
  dataUrl: string
}

export interface MouthAnalysis {
  /** Share of recorded frames where a face was found (0–1). */
  faceVisible: number
  frames: number
  durationSeconds: number
  /** Seconds where visible speech movement starts and ends. */
  speech: { start: number; end: number } | null
  rest: { opening: number; widthFaceUnits: number }
  checks: VisualCheck[]
  /** Downsampled timeline across the recording. */
  timeline: MouthSample[]
  snapshots: MouthSnapshot[]
  /** False when tracking was too poor to say anything. */
  usable: boolean
}

export type FeedbackStatus = 'suggestion' | 'acknowledged' | 'on_track' | 'insufficient_data'
export type FeedbackSource = 'demo' | 'claude'

export interface PracticeFeedback {
  source: FeedbackSource
  lessonId: LessonId
  status: FeedbackStatus
  practiceFocus: string
  tip: string
  actionId: ActionId
  /** True for scripted demo feedback that ignores the attempt. */
  isIllustrative: boolean
  /** Label for the scripted scenario, e.g. "Example 1 of 2". Demo only. */
  scenarioLabel?: string
  /** What was visible in the attempt, hedged. Null when nothing reliable was seen. */
  observation?: string | null
  /** Short references to the measurements or snapshots behind the observation. */
  evidence?: string[]
  /** How this attempt differs from the previous one, when there is one. */
  comparedToPrevious?: string | null
  /** Model that produced the feedback, for non-demo sources. */
  model?: string
  attemptId: string
}
