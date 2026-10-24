import { ACTIONS } from '../feedback/actions'
import type { ActionId, FeedbackSource, FeedbackStatus, PracticeAttempt, PracticeFeedback } from '../types'
import { Icon } from './Icon'

interface FeedbackPanelProps {
  lessonText: string
  attempt: PracticeAttempt | null
  feedback: PracticeFeedback | null
  loading: FeedbackSource | null
  error: string | null
  /** Null when Claude feedback can be requested for this attempt. */
  claudeUnavailableReason: string | null
  onRequest: (source: FeedbackSource) => void
  onAction: (actionId: ActionId) => void
  onTryAgain: () => void
}

const STATUS_LABELS: Record<FeedbackStatus, { label: string; tone: string }> = {
  on_track: { label: 'On track', tone: 'bg-sage-soft text-sage-dark' },
  suggestion: { label: 'Something to try', tone: 'bg-sky-soft text-sky' },
  acknowledged: { label: 'Change noticed', tone: 'bg-sage-soft text-sage-dark' },
  insufficient_data: { label: 'Not enough to go on', tone: 'bg-amber-soft text-amber-ink' },
}

const DEMO_NOTICE = 'Demo feedback. Your recording has not been automatically assessed.'
const CLAUDE_NOTICE = 'AI feedback from Claude, based on your lip measurements and mouth snapshots. It can be wrong, and it does not hear your audio.'

export function FeedbackPanel({
  lessonText,
  attempt,
  feedback,
  loading,
  error,
  claudeUnavailableReason,
  onRequest,
  onAction,
  onTryAgain,
}: FeedbackPanelProps) {
  const action = feedback ? ACTIONS[feedback.actionId] : null
  const claudeReady = claudeUnavailableReason === null
  const showClaudeNotice = feedback?.source === 'claude' || (!feedback && claudeReady && attempt)
  const snapshotCount = attempt?.analysis?.snapshots.length ?? 0

  return (
    <section aria-labelledby="feedback-heading" className="card flex flex-col gap-4">
      <h2 id="feedback-heading" className="eyebrow">
        Feedback
      </h2>

      <p
        className={`flex gap-2 rounded-[18px] p-3 text-sm font-semibold ${
          showClaudeNotice
            ? 'bg-sky-soft/75 text-sky shadow-[inset_0_0_0_1px_rgb(47_102_144/0.2)]'
            : 'bg-amber-soft/75 text-amber-ink shadow-[inset_0_0_0_1px_rgb(106_74_18/0.2)]'
        }`}
      >
        <Icon name="info" className="mt-0.5 size-4" />
        {showClaudeNotice ? CLAUDE_NOTICE : DEMO_NOTICE}
      </p>

      <div aria-live="polite" className="flex flex-col gap-4">
        {!attempt && !feedback && <p className="py-4 text-center text-ink-soft">Record “{lessonText}” to get feedback.</p>}

        {attempt && !feedback && !loading && (
          <div className="flex flex-col items-start gap-2">
            {claudeReady ? (
              <>
                <button type="button" className="btn-primary" onClick={() => onRequest('claude')}>
                  <Icon name="sparkle" /> Get feedback from Claude
                </button>
                <p className="text-xs text-ink-soft">
                  Sends your lip measurements{snapshotCount > 0 ? ` and ${snapshotCount} mouth-only snapshots` : ''} to Anthropic. Audio is not
                  sent.
                </p>
                <button type="button" className="btn-quiet min-h-9 px-3 text-sm" onClick={() => onRequest('demo')}>
                  Show demo feedback instead
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-primary" onClick={() => onRequest('demo')}>
                  <Icon name="sparkle" /> Show demo feedback
                </button>
                <p className="text-xs text-ink-soft">{claudeUnavailableReason}</p>
              </>
            )}
          </div>
        )}

        {loading && (
          <p role="status" className="mc-pulse py-4 text-center font-semibold">
            {loading === 'claude' ? 'Claude is looking at your attempt…' : 'Preparing demo feedback…'}
          </p>
        )}

        {error && !loading && !feedback && (
          <div role="alert" className="flex flex-col gap-3 rounded-[20px] bg-amber-soft/75 p-4 text-amber-ink">
            <p className="font-semibold">{error}</p>
            <div className="flex flex-wrap gap-2">
              {claudeReady && (
                <button type="button" className="btn-secondary min-h-10 text-sm" onClick={() => onRequest('claude')}>
                  Try Claude again
                </button>
              )}
              <button type="button" className="btn-secondary min-h-10 text-sm" onClick={() => onRequest('demo')}>
                Show demo feedback
              </button>
            </div>
          </div>
        )}

        {feedback && action && (
          <article className="flex flex-col gap-3" aria-label={feedback.source === 'claude' ? 'Claude feedback' : 'Demo feedback'}>
            {feedback.source === 'demo' ? (
              <p className="text-sm font-semibold text-ink-soft">{feedback.scenarioLabel} (scripted)</p>
            ) : (
              <span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${STATUS_LABELS[feedback.status].tone}`}>
                {STATUS_LABELS[feedback.status].label}
              </span>
            )}

            <div className="rounded-[20px] bg-sage-soft/75 p-4">
              <p className="text-sm font-bold text-sage-dark">Practice focus</p>
              <p className="mt-0.5 text-xl font-bold">{feedback.practiceFocus}</p>
            </div>

            {feedback.source === 'claude' && feedback.observation && (
              <div className="rounded-[20px] bg-white/55 p-4 shadow-[inset_0_1px_0.5px_rgb(255_255_255/0.9)]">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">Observed</span>
                  In your attempt
                </p>
                <p className="mt-1 leading-relaxed">{feedback.observation}</p>
                {feedback.comparedToPrevious && (
                  <p className="mt-2 text-sm leading-relaxed">
                    <span className="font-bold">Compared with last time: </span>
                    {feedback.comparedToPrevious}
                  </p>
                )}
                {feedback.evidence && feedback.evidence.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {feedback.evidence.map((item) => (
                      <li key={item} className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs text-ink-soft">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="rounded-[20px] bg-sky-soft/75 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-sky">
                <span className="rounded-full bg-sky px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">Suggestion</span>
                What to try
              </p>
              <p className="mt-1 leading-relaxed">{feedback.tip}</p>
            </div>

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
            {feedback.model && <p className="text-xs text-ink-soft">Generated by {feedback.model}.</p>}
          </article>
        )}
      </div>
    </section>
  )
}
