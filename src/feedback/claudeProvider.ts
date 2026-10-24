import type { PracticeFeedback } from '../types'
import { FEEDBACK_ENDPOINT, type FeedbackApiRequest, type FeedbackApiResponse, type FeedbackApiStatus } from './api'
import type { FeedbackProvider, FeedbackRequest } from './provider'

/**
 * Sends the attempt's lip measurements and mouth snapshots to the local
 * feedback API, which asks Claude. Audio is never sent.
 */
export const claudeFeedbackProvider: FeedbackProvider = {
  id: 'claude',
  label: 'Claude feedback',
  async evaluate({ lesson, attempt, history }: FeedbackRequest): Promise<PracticeFeedback> {
    if (!attempt.analysis?.usable) throw new Error('No usable mouth measurements for this attempt.')
    const previous = [...history].reverse().find((a) => a.analysis?.usable)?.analysis ?? null
    const body: FeedbackApiRequest = {
      lessonId: lesson.id,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      analysis: attempt.analysis,
      previous: previous ? withoutSnapshots(previous) : null,
    }
    let response: Response
    try {
      response = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new Error('Could not reach the MouthCoach server.')
    }
    const result = (await response.json().catch(() => null)) as FeedbackApiResponse | null
    if (!result) throw new Error('The server returned an unreadable reply.')
    if (!result.ok) throw new Error(result.error)
    return result.feedback
  },
}

export async function fetchClaudeStatus(): Promise<FeedbackApiStatus> {
  try {
    const response = await fetch(`${FEEDBACK_ENDPOINT}/status`)
    if (!response.ok) return { available: false, model: null }
    return (await response.json()) as FeedbackApiStatus
  } catch {
    return { available: false, model: null }
  }
}

function withoutSnapshots(analysis: NonNullable<FeedbackApiRequest['previous']> & { snapshots?: unknown }) {
  const { snapshots: _snapshots, ...rest } = analysis
  return rest
}
