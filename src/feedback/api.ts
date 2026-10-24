import type { LessonId, MouthAnalysis, PracticeFeedback } from '../types'

// Request and response shapes for the local feedback API (see server/).

export const FEEDBACK_ENDPOINT = '/api/feedback'

export interface FeedbackApiRequest {
  lessonId: LessonId
  attemptId: string
  attemptNumber: number
  analysis: MouthAnalysis
  /** Measurements from the learner's previous attempt at this lesson, without snapshots. */
  previous: Omit<MouthAnalysis, 'snapshots'> | null
}

export type FeedbackApiResponse = { ok: true; feedback: PracticeFeedback } | { ok: false; error: string }

export interface FeedbackApiStatus {
  available: boolean
  model: string | null
}
