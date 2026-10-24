import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './animation/usePrefersReducedMotion'
import type { PlaybackSpeed } from './animation/useTimeline'
import { AudioPlayback } from './components/AudioPlayback'
import { CameraPreview, type PracticeMode } from './components/CameraPreview'
import { FeedbackPanel } from './components/FeedbackPanel'
import { Icon } from './components/Icon'
import { LessonGuide } from './components/LessonGuide'
import { LessonSelector } from './components/LessonSelector'
import { RecorderControls } from './components/RecorderControls'
import { ReferenceMouth, type AnimationMode } from './components/ReferenceMouth'
import { lessons, lessonsById } from './data/lessons'
import { ACTIONS } from './feedback/actions'
import { demoFeedbackProvider } from './feedback/demoProvider'
import type { FeedbackProvider } from './feedback/provider'
import { useAudioLevel } from './media/useAudioLevel'
import { useDemoRecorder } from './media/useDemoRecorder'
import { useMediaCapture } from './media/useMediaCapture'
import { useRecorder } from './media/useRecorder'
import { useReferenceAudio } from './speech/useReferenceAudio'
import type { ActionId, LessonId, PracticeAttempt, PracticeFeedback } from './types'

// Swap this for another FeedbackProvider implementation in a later iteration.
const feedbackProvider: FeedbackProvider = demoFeedbackProvider

const STEPS = ['Choose a lesson', 'Watch the guide', 'Record', 'Replay', 'View feedback', 'Correct & retry']

export default function App() {
  const [lessonId, setLessonId] = useState<LessonId>('me')
  const lesson = lessonsById[lessonId]

  // Reference animation
  const [animationMode, setAnimationMode] = useState<AnimationMode>('reference')
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [stepModeChoice, setStepModeChoice] = useState<boolean | null>(null)
  const stepMode = stepModeChoice ?? prefersReducedMotion
  const [playRequest, setPlayRequest] = useState(0)
  const [watched, setWatched] = useState(false)
  const audio = useReferenceAudio()

  // Media capture
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('off')
  const media = useMediaCapture()
  const { level, levelRef } = useAudioLevel(practiceMode === 'live' ? media.stream : null)
  const liveRecorder = useRecorder(media.stream, levelRef)
  const demoRecorder = useDemoRecorder()
  const recorder = practiceMode === 'demo' ? demoRecorder : liveRecorder

  // Attempts and feedback
  const [attempts, setAttempts] = useState<Partial<Record<LessonId, PracticeAttempt[]>>>({})
  const [currentAttempt, setCurrentAttempt] = useState<PracticeAttempt | null>(null)
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [viewedCorrection, setViewedCorrection] = useState(false)
  const feedbackRequestRef = useRef(0)
  const referenceRef = useRef<HTMLDivElement>(null)
  const practiceRef = useRef<HTMLElement>(null)

  // Turn each finished recording into a practice attempt.
  const lastRecordingRef = useRef(recorder.recording)
  useEffect(() => {
    const recording = recorder.recording
    if (!recording || recording === lastRecordingRef.current) return
    lastRecordingRef.current = recording
    const history = attempts[lessonId] ?? []
    const attempt: PracticeAttempt = {
      id: `${lessonId}-${Date.now()}`,
      lessonId,
      attemptNumber: history.length + 1,
      source: recording.url ? 'recording' : 'demo',
      durationMs: recording.durationMs,
      createdAt: Date.now(),
      signal: recording.url ? { peakLevel: recording.peakLevel, usable: !recording.quiet } : undefined,
    }
    setAttempts((all) => ({ ...all, [lessonId]: [...(all[lessonId] ?? []), attempt] }))
    setCurrentAttempt(attempt)
    setFeedback(null)
  }, [recorder.recording, attempts, lessonId])

  const resetPractice = useCallback(() => {
    feedbackRequestRef.current++
    liveRecorder.discard()
    demoRecorder.discard()
    setCurrentAttempt(null)
    setFeedback(null)
    setFeedbackLoading(false)
  }, [liveRecorder, demoRecorder])

  const selectLesson = (id: LessonId) => {
    if (id === lessonId) return
    resetPractice()
    audio.cancel()
    setLessonId(id)
    setAnimationMode('reference')
    setWatched(false)
    setViewedCorrection(false)
  }

  const startMedia = () => {
    demoRecorder.discard()
    setPracticeMode('live')
    void media.start()
  }

  const startDemo = () => {
    media.stop()
    liveRecorder.discard()
    setPracticeMode('demo')
  }

  const stopPractice = () => {
    media.stop()
    resetPractice()
    setPracticeMode('off')
  }

  const requestFeedback = async () => {
    if (!currentAttempt) return
    const requestId = ++feedbackRequestRef.current
    setFeedbackLoading(true)
    const history = (attempts[lessonId] ?? []).filter((attempt) => attempt.id !== currentAttempt.id)
    const result = await feedbackProvider.evaluate({ lesson, attempt: currentAttempt, history, viewedCorrection })
    if (requestId !== feedbackRequestRef.current) return
    setFeedback(result)
    setFeedbackLoading(false)
    setViewedCorrection(false)
  }

  const runAction = (actionId: ActionId) => {
    const { behavior } = ACTIONS[actionId]
    if (behavior === 'reset-practice') {
      tryAgain()
      return
    }
    if (behavior === 'replay-reference') setSpeed(0.5)
    setAnimationMode('correction')
    setPlayRequest((n) => n + 1)
    setViewedCorrection(true)
    referenceRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
  }

  const tryAgain = () => {
    resetPractice()
    practiceRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
  }

  const changeAnimationMode = (mode: AnimationMode) => {
    setAnimationMode(mode)
    if (mode === 'correction') setViewedCorrection(true)
  }

  const markWatched = useCallback(() => setWatched(true), [])

  const currentStep = feedback ? (animationMode === 'correction' ? 5 : 4) : currentAttempt ? 3 : watched ? 2 : 1
  const attemptCounts = Object.fromEntries(Object.entries(attempts).map(([id, list]) => [id, list?.length ?? 0]))

  return (
    <div className="min-h-screen">
      <a href="#practice" className="sr-only rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-10">
        Skip to practice
      </a>
      <header className="relative z-20 sm:sticky sm:top-3 mx-auto mt-3 mb-5 max-w-7xl px-4 sm:px-6">
        <div className="glass flex items-center justify-between gap-3 rounded-[26px] px-4 py-2.5 sm:rounded-full sm:px-5">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="size-10 shrink-0" aria-hidden="true">
            <rect width="64" height="64" rx="18" fill="#3f7d5c" />
            <path d="M14 33c6-8 30-8 36 0-6 11-30 11-36 0z" fill="#faf6ef" />
            <path d="M14 33c10 3 26 3 36 0" stroke="#1d3b2c" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MouthCoach</h1>
            <p className="text-sm text-ink-soft">Practice American English pronunciation with visual guidance.</p>
          </div>
        </div>
        <span className="hidden shrink-0 rounded-full bg-white/55 px-3 py-1 text-sm font-semibold text-ink-soft sm:inline">Training aid</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <LessonSelector lessons={lessons} selectedId={lessonId} attemptCounts={attemptCounts} onSelect={selectLesson} />
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <ol aria-label="Practice steps" className="glass flex flex-wrap gap-x-4 gap-y-2 rounded-[22px] px-4 py-3 text-sm">
            {STEPS.map((step, index) => {
              const done = index < currentStep
              const current = index === currentStep
              return (
                <li
                  key={step}
                  aria-current={current ? 'step' : undefined}
                  className={`flex items-center gap-1.5 ${current ? 'font-bold text-ink' : done ? 'text-sage-dark' : 'text-ink-soft'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
                      current ? 'bg-sage text-white' : done ? 'bg-sage-soft text-sage-dark' : 'bg-white/70 text-ink-soft'
                    }`}
                  >
                    {done ? <Icon name="check" className="size-3.5" /> : index + 1}
                  </span>
                  {step}
                  {done && <span className="sr-only"> (done)</span>}
                </li>
              )
            })}
          </ol>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-5">
              <div ref={referenceRef} className="scroll-mt-28">
                <ReferenceMouth
                  lesson={lesson}
                  mode={animationMode}
                  onModeChange={changeAnimationMode}
                  speed={speed}
                  onSpeedChange={setSpeed}
                  stepMode={stepMode}
                  onStepModeChange={setStepModeChoice}
                  playRequest={playRequest}
                  audio={audio}
                  onWatched={markWatched}
                />
              </div>
              <LessonGuide lesson={lesson} />
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <section id="practice" ref={practiceRef} aria-labelledby="practice-heading" className="card flex scroll-mt-28 flex-col gap-4">
                <h2 id="practice-heading" className="eyebrow">
                  Your practice
                </h2>
                <CameraPreview
                  mode={practiceMode}
                  stream={media.stream}
                  camera={media.camera}
                  microphone={media.microphone}
                  errorMessage={media.errorMessage}
                  onStart={startMedia}
                  onDemo={startDemo}
                  onStop={stopPractice}
                />
                <RecorderControls recorder={recorder} mode={practiceMode} level={level} lessonText={lesson.text} />
                {recorder.recording && (
                  <AudioPlayback recording={recorder.recording} message={recorder.message} onDiscard={resetPractice} />
                )}
              </section>

              <FeedbackPanel
                lessonText={lesson.text}
                attempt={currentAttempt}
                feedback={feedback}
                loading={feedbackLoading}
                onRequest={requestFeedback}
                onAction={runAction}
                onTryAgain={tryAgain}
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-sm leading-relaxed text-ink-soft sm:px-6">
        MouthCoach is a practice aid for language learners. It does not diagnose or treat any condition, illustrations are simplified,
        and recordings never leave your browser.
      </footer>
    </div>
  )
}
