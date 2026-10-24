import { ACTIONS } from '../feedback/actions'
import type { ActionId, PracticeAttempt, PracticeFeedback } from '../types'
import { Icon } from './Icon'

interface FeedbackPanelProps {
  lessonText: string
  attempt: PracticeAttempt | null
  feedback: PracticeFeedback | null
  loading: boolean
  onRequest: () => void
  onAction: (actionId: ActionId) => void
  onTryAgain: () => void
}

export function FeedbackPanel({ lessonText, attempt, feedback, loading, onRequest, onAction, onTryAgain }: FeedbackPanelProps) {
  const action = feedback ? ACTIONS[feedback.actionId] : null

  return (
    <section aria-labelledby="feedback-heading" className="card flex flex-col gap-4">
      <h2 id="feedback-heading" className="eyebrow">
        Feedback
      </h2>

      <p className="flex gap-2 rounded-[18px] bg-amber-soft/75 p-3 text-sm font-semibold text-amber-ink shadow-[inset_0_0_0_1px_rgb(106_74_18/0.2)]">
        <Icon name="info" className="mt-0.5 size-4" />
        Demo feedback. Your recording has not been automatically assessed.
      </p>

      <div aria-live="polite" className="flex flex-col gap-4">
        {!attempt && !feedback && (
          <p className="py-4 text-center text-ink-soft">Record “{lessonText}” to see example feedback.</p>
        )}

        {attempt && !feedback && !loading && (
          <button type="button" className="btn-primary self-start" onClick={onRequest}>
            <Icon name="sparkle" /> Show demo feedback
          </button>
        )}

        {loading && (
          <p role="status" className="mc-pulse py-4 text-center font-semibold">
            Preparing demo feedback…
          </p>
        )}

        {feedback && action && (
          <article className="flex flex-col gap-3" aria-label="Demo feedback">
            <p className="text-sm font-semibold text-ink-soft">{feedback.scenarioLabel} (scripted)</p>
            <dl className="flex flex-col gap-3">
              <div className="rounded-[20px] bg-sage-soft/75 p-4">
                <dt className="text-sm font-bold text-sage-dark">Practice focus</dt>
                <dd className="mt-0.5 text-xl font-bold">{feedback.practiceFocus}</dd>
              </div>
              <div className="rounded-[20px] bg-sky-soft/75 p-4">
                <dt className="text-sm font-bold text-sky">Suggestion</dt>
                <dd className="mt-1 leading-relaxed">{feedback.tip}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              {action.behavior !== 'reset-practice' && (
                <button type="button" className="btn-primary" onClick={() => onAction(feedback.actionId)} title={action.description}>
                  <Icon name="play" /> {action.label}
                </button>
              )}
              <button
                type="button"
                className={action.behavior === 'reset-practice' ? 'btn-primary' : 'btn-secondary'}
                onClick={onTryAgain}
              >
                <Icon name="replay" /> Try again
              </button>
            </div>
          </article>
        )}
      </div>
    </section>
  )
}
