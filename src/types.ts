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
}

export type FeedbackStatus = 'suggestion' | 'acknowledged'

export interface PracticeFeedback {
  source: 'demo'
  lessonId: LessonId
  status: FeedbackStatus
  practiceFocus: string
  tip: string
  actionId: ActionId
  isIllustrative: true
  /** Human-readable label for the scripted scenario, e.g. "Example 1 of 2". */
  scenarioLabel: string
  attemptId: string
}
