import { useEffect, useState } from 'react'
import { SHAPE_LABELS, SHAPES, sampleTimeline } from '../animation/shapes'
import { useTimeline, type PlaybackSpeed } from '../animation/useTimeline'
import type { ReferenceAudio } from '../speech/useReferenceAudio'
import type { Lesson } from '../types'
import { Icon } from './Icon'
import { MouthIllustration } from './MouthIllustration'

export type AnimationMode = 'reference' | 'correction'

interface ReferenceMouthProps {
  lesson: Lesson
  mode: AnimationMode
  onModeChange: (mode: AnimationMode) => void
  speed: PlaybackSpeed
  onSpeedChange: (speed: PlaybackSpeed) => void
  stepMode: boolean
  onStepModeChange: (stepMode: boolean) => void
  /** Incrementing this number restarts playback (used by feedback actions). */
  playRequest: number
  audio: ReferenceAudio
  onWatched: () => void
}

export function ReferenceMouth({
  lesson,
  mode,
  onModeChange,
  speed,
  onSpeedChange,
  stepMode,
  onStepModeChange,
  playRequest,
  audio,
  onWatched,
}: ReferenceMouthProps) {
  const timeline = mode === 'correction' ? lesson.correction.timeline : lesson.timeline
  const playback = useTimeline(timeline, speed)
  const [stepIndex, setStepIndex] = useState(0)

  // Reset the discrete step when the timeline changes.
  const [prevTimeline, setPrevTimeline] = useState(timeline)
  if (prevTimeline !== timeline) {
    setPrevTimeline(timeline)
    setStepIndex(0)
  }

  const { replay, finished } = playback
  useEffect(() => {
    if (playRequest > 0 && !stepMode) replay()
  }, [playRequest, stepMode, replay])

  useEffect(() => {
    if (finished) onWatched()
  }, [finished, onWatched])

  const sample = sampleTimeline(timeline, playback.time)
  const activeIndex = Math.min(stepMode ? stepIndex : sample.stepIndex, timeline.length - 1)
  const activeStep = timeline[activeIndex]
  const params = stepMode ? SHAPES[activeStep.shape] : sample.params
  const correction = mode === 'correction' ? lesson.correction : null
  const label = `Mouth illustration for “${lesson.text}”: ${SHAPE_LABELS[activeStep.shape]}. ${activeStep.caption}`

  const goToStep = (index: number) => {
    const next = Math.max(0, Math.min(timeline.length - 1, index))
    setStepIndex(next)
    if (next === timeline.length - 1) onWatched()
  }

  return (
    <section aria-labelledby="reference-heading" className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow" id="reference-heading">
            Reference
          </p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight" lang="en-US">
            {lesson.text}
          </p>
          <p className="mt-1 text-ink-soft">
            <span className="font-bold text-ink">{lesson.pronunciation.respelling}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono text-[0.95em]" aria-label={`IPA ${lesson.pronunciation.ipa}`}>
              {lesson.pronunciation.ipa}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            className="btn-secondary min-h-10 px-4 text-sm"
            onClick={() => audio.speak(lesson.text, speed === 0.5)}
            disabled={!audio.available}
            aria-label={`Hear “${lesson.text}” spoken by a browser voice`}
          >
            <Icon name="speaker" />
            {audio.speaking ? 'Speaking…' : 'Hear it'}
          </button>
          {!audio.available && (
            <p className="max-w-[12rem] text-right text-xs text-ink-soft">Audio preview is unavailable on this device.</p>
          )}
        </div>
      </div>

      <div role="group" aria-label="Animation mode" className="seg-track grid grid-cols-2 text-sm">
        {(
          [
            ['reference', 'Reference'],
            ['correction', 'Correction guidance'],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => onModeChange(value)}
className="seg-item min-h-10"
          >
            {text}
          </button>
        ))}
      </div>

      <div
        className={`overflow-hidden rounded-[22px] bg-white/35 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.7)] ring-1 ${
          mode === 'correction' ? 'ring-sky/50' : 'ring-line'
        }`}
      >
        <MouthIllustration params={params} label={label} correction={correction} />
        <div className="flex min-h-14 items-center gap-3 border-t border-white/60 bg-white/50 px-4 py-2">
          {activeStep.sound && (
            <span className="shrink-0 rounded-full bg-sage-soft px-2.5 py-0.5 font-mono text-sm font-bold text-sage-dark">
              {activeStep.sound}
            </span>
          )}
          <p className="text-base font-semibold" aria-live={stepMode ? 'polite' : 'off'}>
            {activeStep.caption}
          </p>
        </div>
      </div>

      {mode === 'correction' && (
        <div className="rounded-[20px] bg-sky-soft/70 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-sky">
            <Icon name="lightbulb" /> Practice suggestion
          </p>
          <p className="mt-1 text-base font-semibold">{lesson.correction.instruction}</p>
          <p className="mt-1 text-sm text-ink-soft">General guidance, not an observation about you.</p>
        </div>
      )}

      {stepMode ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => goToStep(activeIndex - 1)} disabled={activeIndex === 0}>
              <Icon name="prev" /> Previous
            </button>
            <p className="flex-1 text-center text-sm font-bold text-ink-soft">
              Step {activeIndex + 1} of {timeline.length}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => goToStep(activeIndex + 1)}
              disabled={activeIndex === timeline.length - 1}
            >
              Next <Icon name="next" />
            </button>
          </div>
          <ol className="flex flex-col gap-1 text-sm">
            {timeline.map((step, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  aria-current={index === activeIndex ? 'step' : undefined}
                  className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left ${
                    index === activeIndex ? 'bg-sage-soft/80 font-bold' : 'hover:bg-white/55'
                  }`}
                >
                  <span className="w-5 shrink-0 text-ink-soft">{index + 1}.</span>
                  <span>
                    {step.caption} <span className="text-ink-soft">({SHAPE_LABELS[step.shape]})</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {playback.playing ? (
              <button type="button" className="btn-primary min-w-28" onClick={playback.pause}>
                <Icon name="pause" /> Pause
              </button>
            ) : (
              <button type="button" className="btn-primary min-w-28" onClick={playback.play}>
                <Icon name="play" /> {playback.time > 0 && !playback.finished ? 'Resume' : 'Play'}
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={playback.replay}>
              <Icon name="replay" /> Replay
            </button>
            <div role="group" aria-label="Playback speed" className="seg-track ml-auto flex text-sm">
              {(
                [
                  [1, 'Normal'],
                  [0.5, 'Slow'],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={speed === value}
                  onClick={() => onSpeedChange(value)}
                  className="seg-item"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm text-ink-soft">
            <span className="sr-only">Animation progress</span>
            <input
              type="range"
              min={0}
              max={playback.duration}
              step={10}
              value={playback.time}
              onChange={(event) => playback.seek(Number(event.target.value))}
              aria-valuetext={`${Math.round(playback.progress * 100)} percent, ${activeStep.caption}`}
              className="h-2 flex-1 cursor-pointer accent-sage"
            />
            <span className="w-24 shrink-0 text-right tabular-nums">
              {(playback.time / 1000 / speed).toFixed(1)}s / {(playback.duration / 1000 / speed).toFixed(1)}s
            </span>
          </label>
        </div>
      )}

      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={stepMode}
          onChange={(event) => onStepModeChange(event.target.checked)}
          className="size-5 accent-sage"
        />
        Step-by-step view (no motion)
      </label>
    </section>
  )
}
