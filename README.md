# MouthCoach

Practice American English pronunciation with visual guidance.

MouthCoach is a frontend prototype of a pronunciation practice tool for language learners and anyone who wants extra speech
practice. It is a training aid. It does not diagnose, treat or assess any condition.

## Setup and run

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build at http://127.0.0.1:4173
npm test           # Playwright browser tests (starts the dev server automatically)
npm run lint
```

No API keys, backend or network services are needed. Fonts and icons are bundled locally. Camera and microphone access require
`localhost` or HTTPS.

## What works

- **Six preset lessons:** “me”, “moon”, “fish”, “pea”, “bee” and “See me.”, each with a pronunciation reference, explanation, visible
  target movement, practice tip, correction guide and demo feedback content.
- **SVG reference mouth** built from code-driven paths with seven reusable states (rest, closed, open, spread, rounded, lower lip
  to upper teeth, teeth together) and smooth interpolation along hand-authored timelines.
- **Playback controls:** play, pause/resume, replay, normal and slow speed, and a seekable progress bar.
- **Correction guidance mode** per lesson with a dashed target outline, highlighted lip regions, directional arrows and a short
  instruction, labeled as a general practice suggestion rather than an observation about the learner.
- **Step-by-step view** showing discrete mouth states with written captions. It turns on automatically when the system asks for
  reduced motion.
- **Optional reference audio** through a local `en-US` browser voice. If none is available, the page shows “Audio preview is
  unavailable on this device.”
- **Camera and microphone,** requested only when the user clicks: a mirrored preview with a positioning guide, separate camera
  and microphone status, and a live microphone level meter based on real measurements.
- **Recording:** start/stop, elapsed time, an automatic stop at 10 seconds, playback, and discard. Empty or very short
  recordings are flagged as unusable. Recordings stay in memory as object URLs, which are revoked on discard. Media tracks stop
  when they are turned off.
- **Graceful fallbacks:** denied permission, missing devices (including camera-only or microphone-only), and unsupported
  browsers all show a message plus **Try demo mode**.
- **Demo mode:** the whole flow (record, review, feedback, correction, retry) works without any permission.
- **Liquid Glass styling:** translucent, blurred surfaces with light-catching edges over a soft color backdrop, capsule controls and a floating header. It falls back to solid surfaces when the system asks for reduced transparency or the browser cannot blur.
- **Responsive layout:** lesson selector, reference and guide, practice, and feedback sit side by side on desktop and stack on
  mobile. Keyboard focus is visible and the page has a skip link.

## Demonstration behaviors

Feedback comes from `demoFeedbackProvider` (`src/feedback/demoProvider.ts`), a deterministic script that **does not analyze
the recording**:

1. The first attempt in a lesson receives that lesson’s corrective suggestion (“Example 1 of 2”). Its next action opens the
   correction animation.
2. Later attempts show how the interface would acknowledge a change (“Example 2 of 2”). Its next action is “Try again.”

Every feedback view shows “Demo feedback. Your recording has not been automatically assessed.” The microphone measurement (signal
level only) is shown separately from the feedback. The app shows no scores, percentages or claims about tongue position.

## Reserved for later development

- Real audio analysis (voicing, vowel quality, timing).
- Visible mouth analysis from the camera feed.
- An AI provider or local model inference (for example, Gemma), and any fine-tuning.
- User accounts, saved progress, and lesson authoring.
- Persisting or uploading recordings.

## Claude API key (for upcoming features)

Copy `.env.example` to `.env` (already done locally) and set `ANTHROPIC_API_KEY`. The key is read only on the server side: never give it a `VITE_` prefix, because Vite bundles `VITE_*` variables into browser code. The dev server refuses to start if a key-like variable has that prefix. `.env` is ignored by git.

## Project structure

```
src/
  types.ts                 Lesson, keyframe, attempt and feedback types
  data/lessons.ts          Lesson content and animation timelines
  animation/               Mouth shape parameters, geometry, timeline playback, reduced-motion hook
  media/                   Camera/mic capture, recorder, demo recorder, audio level meter
  speech/                  Optional en-US browser voice
  feedback/                FeedbackProvider interface, demo provider, actionId → behavior map
  components/              LessonSelector, ReferenceMouth, MouthIllustration, CorrectionOverlay,
                           CameraPreview, RecorderControls, AudioPlayback, FeedbackPanel, ...
e2e/                       Playwright tests (fake media devices, permission denial, layout)
```

To add a real feedback source, implement `FeedbackProvider` (`src/feedback/provider.ts`) and swap it in at the top of
`src/App.tsx`. Feedback `actionId` values (`replay_reference`, `practice_lip_closure`, `practice_rounded_shape`,
`practice_lip_teeth_position`, `record_again`) map to frontend behaviors in `src/feedback/actions.ts`.
