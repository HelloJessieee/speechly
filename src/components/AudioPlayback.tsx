import type { Recording } from '../media/useRecorder'
import { formatTime } from '../media/format'
import { Icon } from './Icon'

interface AudioPlaybackProps {
  recording: Recording
  message: string | null
  onDiscard: () => void
}

/** Replays the in-memory recording and shows the separate signal measurement. */
export function AudioPlayback({ recording, message, onDiscard }: AudioPlaybackProps) {
  const simulated = recording.url === null
  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-white/45 p-4 shadow-[inset_0_1px_0.5px_rgb(255_255_255/0.9)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold">Your attempt</h3>
        <span className="text-sm text-ink-soft tabular-nums">{formatTime(recording.durationMs)}</span>
      </div>
      {simulated ? (
        <p className="rounded-xl bg-amber-soft/80 px-3 py-2 text-sm text-amber-ink">Demo attempt — no audio was captured.</p>
      ) : (
        <audio controls src={recording.url ?? undefined} className="w-full" aria-label="Replay your recording">
          Your browser cannot play this recording.
        </audio>
      )}
      {!simulated && (
        <p className="text-sm">
          <span className="font-bold">Mic signal: </span>
          {recording.quiet ? 'very quiet' : 'sound detected'}
          <span className="text-ink-soft"> (loudness only, not pronunciation)</span>
          {message && <span className="mt-1 block font-bold text-amber-ink">{message}</span>}
        </p>
      )}
      <button type="button" className="btn-quiet self-start px-3 text-sm" onClick={onDiscard}>
        <Icon name="trash" className="size-4" /> Discard recording
      </button>
    </div>
  )
}
