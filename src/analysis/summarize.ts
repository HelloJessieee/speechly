import type { CheckResult, Lesson, MouthAnalysis, MouthSample, MouthSnapshot, VisualCheck, VisualCheckId } from '../types'
import { trimRange, type FrameFeatures } from './features'

export interface CapturedFrame {
  /** Seconds from the start of the recording. */
  t: number
  features: FrameFeatures | null
  /** JPEG data URL of the mouth crop, when a face was found. */
  crop: string | null
}

// Thresholds are in face widths or ratios to the learner's own rest shape, so
// they adapt to each face. They were chosen conservatively: "unclear" is
// preferred over a confident wrong answer.
const CLOSED_OPENING = 0.012
const OPEN_AFTER_CLOSURE = 0.03
const MIN_FACE_VISIBLE = 0.6
const MAX_SNAPSHOTS = 4
const TIMELINE_POINTS = 24

const median = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const round = (value: number, digits = 3) => Number(value.toFixed(digits))

interface Tracked {
  index: number
  t: number
  f: FrameFeatures
  crop: string | null
}

/** Turns the frames captured during one recording into a lesson-aware analysis. */
export function summarizeCapture(frames: CapturedFrame[], lesson: Lesson): MouthAnalysis {
  const tracked: Tracked[] = frames.flatMap((frame, index) => (frame.features ? [{ index, t: frame.t, f: frame.features, crop: frame.crop }] : []))
  const durationSeconds = frames.length ? frames[frames.length - 1].t : 0
  const faceVisible = frames.length ? tracked.length / frames.length : 0
  const empty: MouthAnalysis = {
    faceVisible: round(faceVisible, 2),
    frames: frames.length,
    durationSeconds: round(durationSeconds, 2),
    speech: null,
    rest: { opening: 0, widthFaceUnits: 0 },
    checks: [],
    timeline: [],
    snapshots: [],
    usable: false,
  }
  if (tracked.length < 10 || faceVisible < MIN_FACE_VISIBLE) return empty

  const opening = tracked.map((s) => s.f.opening)
  const width = tracked.map((s) => s.f.width)
  const range = trimRange(opening, width)
  const [start, end] = range ?? [0, tracked.length - 1]

  // Rest shape: frames outside the movement window, or else the most closed frames.
  let restFrames = tracked.filter((_, i) => i < start || i > end)
  if (restFrames.length < 3) {
    const byOpening = [...tracked].sort((a, b) => a.f.opening - b.f.opening)
    restFrames = byOpening.slice(0, Math.max(3, Math.round(tracked.length * 0.2)))
  }
  const rest = {
    opening: median(restFrames.map((s) => s.f.opening)),
    width: median(restFrames.map((s) => s.f.width)),
    lowerLip: median(restFrames.map((s) => s.f.lowerLip)),
    protrusion: median(restFrames.map((s) => s.f.protrusion)),
  }

  const speechFrames = tracked.slice(start, end + 1)
  const checks: VisualCheck[] = []
  const snapshotCandidates: { label: string; frame: Tracked }[] = []

  for (const id of lesson.visualChecks) {
    const result = runCheck(id, { tracked, speechFrames, start, end, rest, lessonId: lesson.id })
    checks.push(result.check)
    if (result.frame) snapshotCandidates.push({ label: result.snapshotLabel, frame: result.frame })
  }

  const peakOpen = speechFrames.reduce((best, s) => (s.f.opening > best.f.opening ? s : best), speechFrames[0])
  const restFrame = restFrames.find((s) => s.crop) ?? tracked[0]
  const snapshots = pickSnapshots([
    { label: 'Rest, before speaking', frame: restFrame },
    ...snapshotCandidates,
    { label: 'Widest opening', frame: peakOpen },
  ])

  const points = Math.min(TIMELINE_POINTS, tracked.length)
  const timeline: MouthSample[] = Array.from({ length: points }, (_, i) => {
    const s = tracked[Math.round((i / Math.max(1, points - 1)) * (tracked.length - 1))]
    return {
      t: round(s.t, 2),
      opening: round(s.f.opening),
      width: round(s.f.width / rest.width),
      lowerLip: round(rest.lowerLip > 0 ? s.f.lowerLip / rest.lowerLip : 1),
      protrusion: round(s.f.protrusion - rest.protrusion),
    }
  })

  return {
    ...empty,
    speech: range ? { start: round(tracked[start].t, 2), end: round(tracked[end].t, 2) } : null,
    rest: { opening: round(rest.opening), widthFaceUnits: round(rest.width) },
    checks,
    timeline,
    snapshots,
    usable: true,
  }
}

interface CheckContext {
  tracked: Tracked[]
  speechFrames: Tracked[]
  start: number
  end: number
  rest: { opening: number; width: number; lowerLip: number; protrusion: number }
  lessonId: Lesson['id']
}

interface CheckOutcome {
  check: VisualCheck
  frame: Tracked | null
  snapshotLabel: string
}

function runCheck(id: VisualCheckId, ctx: CheckContext): CheckOutcome {
  switch (id) {
    case 'closure':
      return closureCheck(ctx)
    case 'rounding':
      return ratioCheck(ctx, {
        id,
        pick: (s) => s.f.width / ctx.rest.width,
        better: 'lower',
        detectedAt: 0.88,
        unclearAt: 0.94,
        snapshotLabel: 'Most rounded shape',
        neutralLabel: 'Narrowest moment',
        summaries: {
          detected: 'Your mouth corners moved inward, narrower than your resting width — a rounded shape.',
          unclear: 'Your mouth corners moved inward a little. The rounding was slight.',
          not_detected: 'Your mouth width stayed close to your resting width, so rounding was not visible.',
        },
      })
    case 'spread':
      return ratioCheck(ctx, {
        id,
        pick: (s) => s.f.width / ctx.rest.width,
        better: 'higher',
        detectedAt: 1.05,
        unclearAt: 1.02,
        snapshotLabel: 'Most spread shape',
        neutralLabel: 'Widest moment',
        summaries: {
          detected: 'Your lips spread wider than at rest, as they do for “ee.”',
          unclear: 'Your lips spread slightly wider than at rest.',
          not_detected: 'Your lip width stayed close to rest during the vowel.',
        },
      })
    case 'lipTeeth':
      return ratioCheck(
        // The lip–teeth contact happens near the start of “fish”.
        { ...ctx, speechFrames: ctx.speechFrames.slice(0, Math.max(3, Math.ceil(ctx.speechFrames.length / 2))) },
        {
          id,
          pick: (s) => (s.f.opening < 0.04 && ctx.rest.lowerLip > 0 ? s.f.lowerLip / ctx.rest.lowerLip : 1),
          better: 'lower',
          detectedAt: 0.72,
          unclearAt: 0.85,
          snapshotLabel: 'Lower lip raised toward the upper teeth',
          neutralLabel: 'Start of the word',
          summaries: {
            detected: 'Your lower lip appeared to tuck up and look thinner, as it does when it meets the upper teeth. Teeth are not tracked, so this is an estimate.',
            unclear: 'Your lower lip may have moved up slightly. Teeth are not tracked, so this is hard to confirm.',
            not_detected: 'Your lower lip did not visibly tuck up at the start. Teeth are not tracked, so check the snapshot.',
          },
        },
      )
  }
}

function closureCheck(ctx: CheckContext): CheckOutcome {
  const { tracked, start, end } = ctx
  // Look slightly before the movement window: “me” starts from closed lips.
  const from = Math.max(0, start - 6)
  const mustFollowOpening = ctx.lessonId === 'see-me'
  let best: { frame: Tracked; minOpening: number; closed: number } | null = null

  for (let i = from; i <= end; i++) {
    if (tracked[i].f.opening >= CLOSED_OPENING) continue
    let j = i
    while (j + 1 <= end && tracked[j + 1].f.opening < CLOSED_OPENING) j++
    const closedFrames = j - i + 1
    const opensAfter = tracked.slice(j + 1, j + 25).some((s) => s.f.opening > OPEN_AFTER_CLOSURE)
    const openedBefore = tracked.slice(Math.max(0, i - 25), i).some((s) => s.f.opening > OPEN_AFTER_CLOSURE)
    if (opensAfter && (!mustFollowOpening || openedBefore) && closedFrames >= 2) {
      const mid = tracked[Math.floor((i + j) / 2)]
      if (!best || closedFrames > best.closed) best = { frame: mid, minOpening: Math.min(...tracked.slice(i, j + 1).map((s) => s.f.opening)), closed: closedFrames }
    }
    i = j
  }

  const where = mustFollowOpening ? 'between the two words' : 'before opening into the vowel'
  if (best) {
    return {
      check: {
        id: 'closure',
        result: 'detected',
        summary: `Your lips came together ${where} (at about ${best.frame.t.toFixed(1)} s).`,
        atSeconds: round(best.frame.t, 2),
        value: round(best.minOpening),
      },
      frame: best.frame,
      snapshotLabel: 'Lips together',
    }
  }

  // No full closure: report the most closed moment in the window.
  const window = tracked.slice(from, end + 1)
  const closest = window.reduce((a, b) => (b.f.opening < a.f.opening ? b : a), window[0])
  const result: CheckResult = closest.f.opening < CLOSED_OPENING * 1.8 ? 'unclear' : 'not_detected'
  return {
    check: {
      id: 'closure',
      result,
      summary:
        result === 'unclear'
          ? `Your lips came close together ${where}, but a full closure was not clear.`
          : `Your lips did not visibly close ${where}.`,
      atSeconds: round(closest.t, 2),
      value: round(closest.f.opening),
    },
    frame: closest,
    snapshotLabel: 'Most closed moment',
  }
}

interface RatioOptions {
  id: VisualCheckId
  pick: (s: Tracked) => number
  better: 'lower' | 'higher'
  detectedAt: number
  unclearAt: number
  snapshotLabel: string
  /** Label used when the movement was not clearly seen, so it never claims a shape. */
  neutralLabel: string
  summaries: Record<CheckResult, string>
}

function ratioCheck(ctx: CheckContext, options: RatioOptions): CheckOutcome {
  const frames = ctx.speechFrames
  const extreme = frames.reduce((a, b) => {
    const [va, vb] = [options.pick(a), options.pick(b)]
    return options.better === 'lower' ? (vb < va ? b : a) : vb > va ? b : a
  }, frames[0])
  const value = options.pick(extreme)
  const passes = (threshold: number) => (options.better === 'lower' ? value <= threshold : value >= threshold)
  const result: CheckResult = passes(options.detectedAt) ? 'detected' : passes(options.unclearAt) ? 'unclear' : 'not_detected'
  return {
    check: { id: options.id, result, summary: options.summaries[result], atSeconds: round(extreme.t, 2), value: round(value) },
    frame: extreme,
    snapshotLabel: result === 'detected' ? options.snapshotLabel : options.neutralLabel,
  }
}

function pickSnapshots(candidates: { label: string; frame: Tracked }[]): MouthSnapshot[] {
  const chosen: MouthSnapshot[] = []
  for (const { label, frame } of candidates) {
    if (!frame.crop || chosen.length >= MAX_SNAPSHOTS) continue
    // Skip frames that are almost at the same moment as one already chosen.
    if (chosen.some((s) => Math.abs(s.t - frame.t) < 0.12)) continue
    chosen.push({ label, t: round(frame.t, 2), dataUrl: frame.crop })
  }
  return chosen.sort((a, b) => a.t - b.t)
}
