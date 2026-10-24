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

## Claude feedback

When the camera is on, MouthCoach measures the lips while you record and can ask Claude for feedback on that attempt.

1. **Lip tracking (in the browser).** MediaPipe Face Landmarker (478-point face mesh) runs locally on each camera frame. The
   model and WebAssembly runtime are bundled in `public/mediapipe/`, so no CDN is needed.
2. **Measurements (in the browser).** For every frame, `src/analysis/features.ts` measures inner-lip opening, mouth width,
   lower-lip thickness and lip protrusion in the face's own coordinate frame, so head position and camera distance don't matter.
   `src/analysis/summarize.ts` compares the attempt with your own resting mouth and runs the lesson's checks: lip closure, rounding,
   spreading, or the lower lip raised toward the upper teeth. It reports each one as *seen*, *unclear* or *not seen*, and keeps up
   to four small mouth-only snapshots.
3. **Feedback (on the server).** When you click **Get feedback from Claude**, the measurements and snapshots go to
   `POST /api/feedback`. That route is served by the Vite dev and preview servers (`server/feedbackApi.ts`). `server/claudeFeedback.ts`
   calls Claude (`CLAUDE_MODEL`, default `claude-opus-5-5`) with a JSON schema, so the reply is typed feedback:
   status, practice focus, a hedged **observation** with its evidence, a **suggestion**, a comparison with your previous attempt,
   and the next action. Server-side refusal fallback (`fallbacks: "default"`) is enabled for supported models.

Privacy: nothing leaves the browser until you click the Claude button. Then only the measurements and up to four mouth-only JPEG
crops are sent. Audio is never sent, because Claude cannot hear it. Demo feedback remains available offline and as a fallback when
Claude is unavailable.

Limits: landmarks and still images are approximate. Teeth and tongue are not tracked, and sound, voicing and accent are not
assessed. The `/api/feedback` route runs inside the Vite server. A deployed site needs the same handler on a real backend; the
handler is framework-agnostic.

### Testing face tracking

`npm test` runs every test. The face-tracking tests also need a video of a face for Chromium's fake camera:

```bash
FACE_VIDEO=/path/to/face.y4m npm test
```

The Claude API is mocked in tests, so they never spend credits.

### Credits

- Face-frame normalization, lip landmark indices and speech-range trimming are ported from
  [cdiazcastilla/lip-reading-research](https://github.com/cdiazcastilla/lip-reading-research) (MIT).
- [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) Face Landmarker (Apache 2.0).
- [Visual Speech Recognition for Multiple Languages](https://github.com/mpc001/Visual_Speech_Recognition_for_Multiple_Languages)
  was evaluated but not embedded. Its weights are licensed for non-commercial research only, are 0.9–1.5 GB, need a GPU, and
  transcribe whole sentences. Landmark measurements suit single-word movement feedback better.

## Demonstration behaviors

Feedback comes from `demoFeedbackProvider` (`src/feedback/demoProvider.ts`), a deterministic script that **does not analyze
the recording**:

1. The first attempt in a lesson receives that lesson’s corrective suggestion (“Example 1 of 2”). Its next action opens the
   correction animation.
2. Later attempts show how the interface would acknowledge a change (“Example 2 of 2”). Its next action is “Try again.”

Every feedback view shows “Demo feedback. Your recording has not been automatically assessed.” The microphone measurement (signal
level only) is shown separately from the feedback. The app shows no scores, percentages or claims about tongue position.

## iOS app

`ios/` contains a native SwiftUI version for iPhone and iPad, ready to open in Xcode. See [ios/README.md](ios/README.md).

## Reserved for later development

- Audio analysis (voicing, vowel quality, timing), for example with local speech recognition.
- A standalone backend for deployment (the feedback handler is ready to move).
- Local model inference (for example, Gemma), and any fine-tuning.
- User accounts, saved progress, and lesson authoring.
- Persisting or uploading recordings.

## Claude API key

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. The account needs API credits. Restart `npm run dev` after editing `.env`. The key is read only on the server side: never give it a `VITE_` prefix, because Vite bundles `VITE_*` variables into browser code. The dev server refuses to start if a key-like variable has that prefix. `.env` is ignored by git.

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
