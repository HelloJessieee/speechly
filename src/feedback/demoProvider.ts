import type { PracticeFeedback } from '../types'
import type { FeedbackProvider, FeedbackRequest } from './provider'

/**
 * Deterministic demonstration provider. It does not listen to or look at the
 * attempt; it follows a fixed script so the correction and retry flow can be
 * shown end to end:
 *
 *   Example 1 — the first attempt receives the lesson's corrective suggestion.
 *   Example 2 — a later attempt shows how the interface would acknowledge a
 *               change, then points back to recording again.
 */
export const demoFeedbackProvider: FeedbackProvider = {
  id: 'demo',
  label: 'Demo feedback (scripted)',
  async evaluate({ lesson, attempt, history }: FeedbackRequest): Promise<PracticeFeedback> {
    const isFollowUp = history.length > 0
    const content = isFollowUp ? lesson.demoFeedback.acknowledgement : lesson.demoFeedback.suggestion
    // A short pause keeps the loading state visible, as a real provider would have.
    await new Promise((resolve) => setTimeout(resolve, 600))
    return {
      source: 'demo',
      lessonId: lesson.id,
      status: isFollowUp ? 'acknowledged' : 'suggestion',
      practiceFocus: content.practiceFocus,
      tip: content.tip,
      actionId: isFollowUp ? 'record_again' : lesson.correction.actionId,
      isIllustrative: true,
      scenarioLabel: isFollowUp
        ? 'Example 2 of 2: acknowledging a change'
        : 'Example 1 of 2: a corrective suggestion',
      attemptId: attempt.id,
    }
  },
}
