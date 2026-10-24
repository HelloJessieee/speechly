import type { CheckResult, MouthAnalysis, VisualCheckId } from '../types'
import { Icon } from './Icon'

const CHECK_TITLES: Record<VisualCheckId, string> = {
  closure: 'Lip closure',
  rounding: 'Rounded lips',
  spread: 'Spread lips',
  lipTeeth: 'Lower lip to upper teeth',
}

const RESULT_STYLES: Record<CheckResult, { label: string; tone: string }> = {
  detected: { label: 'Seen', tone: 'bg-sage-soft text-sage-dark' },
  unclear: { label: 'Unclear', tone: 'bg-amber-soft text-amber-ink' },
  not_detected: { label: 'Not seen', tone: 'bg-white/70 text-ink-soft' },
}

/** What the face landmarks measured during the attempt, in plain words. */
export function MouthMeasurements({ analysis }: { analysis: MouthAnalysis }) {
  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-white/45 p-4 shadow-[inset_0_1px_0.5px_rgb(255_255_255/0.9)]">
      <div>
        <h3 className="font-bold">What the camera measured</h3>
        <p className="text-xs text-ink-soft">From face landmarks, in your browser. Compared with your own resting mouth.</p>
      </div>

      {analysis.usable ? (
        <ul className="flex flex-col gap-2">
          {analysis.checks.map((check) => {
            const style = RESULT_STYLES[check.result]
            return (
              <li key={check.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{CHECK_TITLES[check.id]}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.tone}`}>{style.label}</span>
                </div>
                <p className="text-sm text-ink-soft">{check.summary}</p>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="flex gap-2 text-sm text-amber-ink">
          <Icon name="info" className="mt-0.5 size-4" />
          Your face wasn’t visible clearly enough to measure. Center your face in the oval, with good light, and try again.
        </p>
      )}

      {analysis.snapshots.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {analysis.snapshots.map((snapshot) => (
            <figure key={snapshot.t} className="flex flex-col gap-1">
              <img
                src={snapshot.dataUrl}
                alt={`Your mouth: ${snapshot.label}, at ${snapshot.t.toFixed(1)} seconds`}
                className="aspect-[4/3] w-full -scale-x-100 rounded-lg object-cover ring-1 ring-line"
              />
              <figcaption className="text-[11px] leading-tight text-ink-soft">{snapshot.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
