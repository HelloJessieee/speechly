import { MAX_RECORDING_MS, type RecorderState } from '../media/useRecorder'
import type { PracticeMode } from './CameraPreview'
import { formatTime } from '../media/format'
import { Icon } from './Icon'
import { LevelMeter } from './LevelMeter'

interface RecorderControlsProps {
  recorder: RecorderState
  mode: PracticeMode
  level: number
  lessonText: string
}

export function RecorderControls({ recorder, mode, level, lessonText }: RecorderControlsProps) {
  const recording = recorder.status === 'recording'
  const enabled = mode === 'demo' || (mode === 'live' && recorder.canRecord)
  const limit = MAX_RECORDING_MS

  // Only show a status line when it adds information the controls do not.
  let statusText = ''
  if (mode === 'live' && !recorder.canRecord) statusText = 'A microphone is needed to record. You can still try demo mode.'
  else if (recording) statusText = `Recording… say “${lessonText}”.`
  else if (recorder.status === 'unusable' || recorder.status === 'error') statusText = recorder.message ?? 'Something went wrong.'

  return (
    <div className="flex flex-col gap-3">
      {mode === 'live' && recorder.canRecord && <LevelMeter level={level} active />}

      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <button type="button" className="btn-record min-w-40" onClick={recorder.stop}>
            <Icon name="stop" /> Stop recording
          </button>
        ) : (
          <button type="button" className="btn-record min-w-40" onClick={recorder.start} disabled={!enabled}>
            <Icon name="record" /> {recorder.status === 'ready' ? 'Record again' : mode === 'demo' ? 'Record (demo)' : 'Record'}
          </button>
        )}
        <div className="flex min-w-36 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between text-sm font-bold tabular-nums">
            <span className={recording ? 'flex items-center gap-1.5 text-rec' : 'text-ink-soft'}>
              {recording && <span aria-hidden="true" className="mc-pulse size-2.5 rounded-full bg-rec" />}
              {recording ? 'REC' : 'Length'} {formatTime(recorder.elapsedMs)}
            </span>
            <span className="text-ink-soft">max {limit / 1000}s</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line shadow-[inset_0_1px_1px_rgb(29_59_44/0.1)]" aria-hidden="true">
            <div className="h-full rounded-full bg-rec/80" style={{ width: `${Math.min(100, (recorder.elapsedMs / limit) * 100)}%` }} />
          </div>
        </div>
      </div>

      <p
        role="status"
        className={`min-h-0 text-sm empty:hidden ${recorder.status === 'unusable' || recorder.status === 'error' ? 'font-bold text-amber-ink' : 'text-ink-soft'}`}
      >
        {statusText}
      </p>
    </div>
  )
}
