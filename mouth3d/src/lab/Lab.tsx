import { useEffect, useRef, useState } from 'react'
import { LESSONS } from '../model/lessons'
import { MouthModel3D, type MouthModel3DHandle } from '../model/MouthModel3D'
import { lerpParams, SHAPE_LABELS, SHAPES, sampleTimeline, type MouthParams } from '../model/shapes'
import { deriveProtrusion, to3DParams } from '../model/surface'
import type { MouthShapeId } from '../model/types'
import type { ViewName } from '../model/viewer'
import { MouthIllustration2D } from './MouthIllustration2D'
import { MILESTONES, type MilestoneStatus } from './progress'
import { useTimeline, type PlaybackSpeed } from './useTimeline'

// Development page for building the 3D mouth: compare it with the 2D drawing,
// try every shape and lesson, and nudge individual parameters.

type Source = 'shape' | 'lesson'

const SHAPE_IDS = Object.keys(SHAPES) as MouthShapeId[]

const VIEW_BUTTONS: [ViewName, string][] = [
  ['front', 'Front'],
  ['threeQuarterLeft', '¾ left'],
  ['threeQuarterRight', '¾ right'],
  ['side', 'Side'],
  ['below', 'From below'],
]

const SLIDERS: { key: keyof MouthParams; label: string; min: number; max: number; step: number }[] = [
  { key: 'open', label: 'Opening', min: 0, max: 40, step: 0.5 },
  { key: 'halfWidth', label: 'Half width', min: 30, max: 95, step: 0.5 },
  { key: 'upperThickness', label: 'Upper lip', min: 6, max: 24, step: 0.5 },
  { key: 'lowerThickness', label: 'Lower lip', min: 6, max: 26, step: 0.5 },
  { key: 'upperTeeth', label: 'Upper teeth', min: 0, max: 1, step: 0.01 },
  { key: 'lowerTeeth', label: 'Lower teeth', min: 0, max: 1, step: 0.01 },
  { key: 'tuck', label: 'Lip to teeth (/f/)', min: 0, max: 1, step: 0.01 },
  { key: 'round', label: 'Roundness', min: 0, max: 1, step: 0.01 },
]

const STATUS_STYLE: Record<MilestoneStatus, { text: string; className: string }> = {
  done: { text: 'Done', className: 'bg-sage-soft text-sage-dark' },
  'in-progress': { text: 'In progress', className: 'bg-amber-soft text-amber-ink' },
  next: { text: 'Next', className: 'bg-white/70 text-ink-soft' },
}

/** Ease the shown parameters toward `target` so shape changes are visible as motion. */
function useEased(target: MouthParams, duration = 380): MouthParams {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  useEffect(() => {
    const from = shownRef.current
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const u = Math.min(1, (now - start) / duration)
      const next = lerpParams(from, target, u * u * (3 - 2 * u))
      shownRef.current = next
      setShown(next)
      if (u < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return shown
}

export function Lab() {
  const modelRef = useRef<MouthModel3DHandle>(null)
  const [source, setSource] = useState<Source>('shape')
  const [shapeId, setShapeId] = useState<MouthShapeId | null>('rest')
  const [manual, setManual] = useState<MouthParams>(SHAPES.rest)
  const [eased, setEased] = useState(true)
  const [protrusion, setProtrusion] = useState<number | null>(null)
  const [wireframe, setWireframe] = useState(false)
  const [lessonId, setLessonId] = useState('moon')
  const [speed, setSpeed] = useState<PlaybackSpeed>(0.5)
  const [angle, setAngle] = useState({ azimuth: 0, elevation: 0 })

  const lesson = LESSONS.find((l) => l.id === lessonId) ?? LESSONS[0]
  const playback = useTimeline(lesson.timeline, speed)
  const sample = sampleTimeline(lesson.timeline, playback.time)
  const step = lesson.timeline[sample.stepIndex]

  const easedManual = useEased(manual)
  const params = source === 'lesson' ? sample.params : eased ? easedManual : manual
  const params3D = to3DParams(params, protrusion ?? undefined)

  const label =
    source === 'lesson'
      ? `3D mouth for “${lesson.text}”: ${SHAPE_LABELS[step.shape]}`
      : `3D mouth: ${shapeId ? SHAPE_LABELS[shapeId] : 'custom shape'}`

  const pickShape = (id: MouthShapeId) => {
    playback.pause()
    setSource('shape')
    setShapeId(id)
    setEased(true)
    setManual(SHAPES[id])
  }

  const nudge = (key: keyof MouthParams, value: number) => {
    playback.pause()
    if (source === 'lesson') setManual({ ...sample.params, [key]: value })
    else setManual({ ...manual, [key]: value })
    setSource('shape')
    setShapeId(null)
    setEased(false)
  }

  const playLesson = () => {
    setSource('lesson')
    playback.replay()
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">MouthCoach · development</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">3D mouth lab</h1>
          <p className="mt-1 max-w-2xl text-ink-soft">
            Drag the model to turn it, scroll to zoom. The 2D drawing on the right gets the same parameters, so you can
            compare them.
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="3D model" className="card flex flex-col gap-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-gradient-to-b from-[#fdf3ec] to-[#f7e4d8] ring-1 ring-line">
            <MouthModel3D
              ref={modelRef}
              params={params3D}
              label={label}
              wireframe={wireframe}
              onViewChange={(azimuth, elevation) => setAngle({ azimuth, elevation })}
            />
            <p className="pointer-events-none absolute top-3 left-3 rounded-full bg-white/75 px-3 py-1 text-xs font-bold text-ink-soft tabular-nums">
              Turn {deg(angle.azimuth)} · Tilt {deg(angle.elevation)}
            </p>
            {source === 'lesson' && (
              <p className="pointer-events-none absolute right-3 bottom-3 left-3 rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold">
                {step.sound && <span className="mr-2 font-mono text-sage-dark">{step.sound}</span>}
                {step.caption}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Camera angle" className="seg-track flex flex-wrap text-sm">
              {VIEW_BUTTONS.map(([view, text]) => (
                <button key={view} type="button" className="seg-item" onClick={() => modelRef.current?.goTo(view)}>
                  {text}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} className="size-5 accent-sage" />
              Wireframe
            </label>
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section aria-label="2D comparison" className="card flex flex-col gap-2">
            <p className="eyebrow">Current 2D drawing</p>
            <div className="overflow-hidden rounded-[22px] bg-white/35 ring-1 ring-line">
              <MouthIllustration2D params={params} label={`2D mouth: ${label}`} />
            </div>
          </section>

          <section aria-labelledby="shapes-heading" className="card flex flex-col gap-3">
            <p className="eyebrow" id="shapes-heading">
              Shapes
            </p>
            <div className="flex flex-wrap gap-2">
              {SHAPE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={source === 'shape' && shapeId === id}
                  onClick={() => pickShape(id)}
                  className="seg-item bg-white/40 text-sm"
                >
                  {SHAPE_LABELS[id]}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="lesson-heading" className="card flex flex-col gap-3">
            <p className="eyebrow" id="lesson-heading">
              Play a lesson
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={lessonId}
                onChange={(e) => {
                  setLessonId(e.target.value)
                  setSource('lesson')
                }}
                aria-label="Lesson"
                className="min-h-11 rounded-full bg-white/70 px-4 font-semibold ring-1 ring-line"
              >
                {LESSONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.text}
                  </option>
                ))}
              </select>
              {source === 'lesson' && playback.playing ? (
                <button type="button" className="btn-primary" onClick={playback.pause}>
                  Pause
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={playLesson}>
                  Play
                </button>
              )}
              <div role="group" aria-label="Playback speed" className="seg-track flex text-sm">
                {(
                  [
                    [1, 'Normal'],
                    [0.5, 'Slow'],
                  ] as const
                ).map(([value, text]) => (
                  <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)} className="seg-item">
                    {text}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={playback.duration}
              step={10}
              value={playback.time}
              onChange={(e) => {
                setSource('lesson')
                playback.seek(Number(e.target.value))
              }}
              aria-label="Lesson position"
              className="h-2 cursor-pointer accent-sage"
            />
          </section>
        </div>
      </div>

      <section aria-labelledby="params-heading" className="card flex flex-col gap-3">
        <p className="eyebrow" id="params-heading">
          Parameters
        </p>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {SLIDERS.map(({ key, label: text, min, max, step: inc }) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="flex justify-between font-semibold">
                {text} <span className="text-ink-soft tabular-nums">{params[key].toFixed(inc < 1 ? 2 : 1)}</span>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={inc}
                value={params[key]}
                onChange={(e) => nudge(key, Number(e.target.value))}
                className="h-2 cursor-pointer accent-sage"
              />
            </label>
          ))}
          <div className="flex flex-col gap-1 text-sm">
            <span className="flex justify-between font-semibold">
              Lips forward (3D only){' '}
              <span className="text-ink-soft tabular-nums">{params3D.protrusion.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={params3D.protrusion}
              onChange={(e) => setProtrusion(Number(e.target.value))}
              aria-label="Lips forward"
              className="h-2 cursor-pointer accent-sage"
            />
            <label className="flex items-center gap-2 text-ink-soft">
              <input
                type="checkbox"
                checked={protrusion === null}
                onChange={(e) => setProtrusion(e.target.checked ? null : deriveProtrusion(params))}
                className="size-4 accent-sage"
              />
              Work it out from roundness
            </label>
          </div>
        </div>
      </section>

      <section aria-labelledby="progress-heading" className="card flex flex-col gap-3">
        <p className="eyebrow" id="progress-heading">
          Build progress
        </p>
        <ol className="flex flex-col gap-2">
          {MILESTONES.map((m, i) => (
            <li key={m.title} className="flex items-start gap-3 rounded-2xl bg-white/45 px-4 py-3">
              <span className="w-5 shrink-0 pt-0.5 font-bold text-ink-soft">{i + 1}.</span>
              <div className="flex-1">
                <p className="font-bold">{m.title}</p>
                <p className="text-sm text-ink-soft">{m.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[m.status].className}`}>
                {STATUS_STYLE[m.status].text}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

const deg = (radians: number) => `${Math.round((radians * 180) / Math.PI)}°`
