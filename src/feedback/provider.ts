import type { Lesson, PracticeAttempt, PracticeFeedback } from '../types'

/**
 * A feedback provider turns a practice attempt into feedback. The prototype
 * ships only the deterministic demo provider; a later version can add real
 * audio analysis, visible mouth analysis, a hosted AI provider or local
 * inference by implementing this interface. A non-demo provider would widen
 * `PracticeFeedback['source']` and set `isIllustrative` accordingly.
 */
export interface FeedbackProvider {
  readonly id: string
  readonly label: string
  evaluate(input: FeedbackRequest): Promise<PracticeFeedback>
}

export interface FeedbackRequest {
  lesson: Lesson
  attempt: PracticeAttempt
  /** Earlier attempts for the same lesson in this session, oldest first. */
  history: PracticeAttempt[]
  /** Whether the learner has viewed correction guidance since the last attempt. */
  viewedCorrection: boolean
}
