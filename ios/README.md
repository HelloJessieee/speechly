# MouthCoach for iOS

A native SwiftUI version of MouthCoach for iPhone and iPad (iOS 17+). It follows the web app's design: the same lessons,
mouth animation, practice flow, landmark measurements and feedback, with Liquid Glass styling on iOS 26.

## Open in Xcode

On a Mac with Xcode 26 (Xcode 15 or newer also works, without Liquid Glass):

```bash
brew install xcodegen          # once
cd ios
xcodegen generate              # creates MouthCoach.xcodeproj from project.yml
open MouthCoach.xcodeproj
```

In Xcode, select the **MouthCoach** target → **Signing & Capabilities**, choose your team, then run on a simulator or a device.
The camera, microphone and lip tracking need a real device; the Simulator has no camera, but demo mode works there.

## Speech Mirror integration

The native iPhone app has three horizontally swipeable pages: **Practice** for
camera, recording, and transcript confirmation; **Mouth Guide** for the looping
sentence reference and live lip overlay; and **Results** for voice measurements,
tentative phoneme comparison, and Gemma suggestions. The pages also have a
bottom navigation bar. All app-facing labels and analysis messages are English.

The app uses the sentence reference and audio analysis in `mac_service/`
without replacing this app's SwiftUI camera, recorder, or seven mouth shapes.
Select **Yellow**, **Blue**, or **Both** on Mouth Guide.
Yellow is a looping reference contour attached to the detected lip center and
scaled to lip width; blue traces the measured lips. The current reference word
is shown beside both views. These visual shapes and timing are illustrative.

Preset lessons and live lip tracking run on the iPhone. For an arbitrary English
sentence or Whisper / phoneme / Gemma analysis, set up and start the included
Python service on the Mac (see [mac_service/README.md](../mac_service/README.md)):

```bash
cd mac_service
.venv/bin/python -m speech_mirror.web --host 0.0.0.0 --port 8765
```

This test build defaults to `http://172.20.10.13:8765` for Speech Mirror requests.
Open the gear icon in the app and save your Mac's current LAN address with port
8765 if it differs. Both devices must be
on the same trusted network. The app opens in free speech mode: record an
English phrase, wait for automatic Whisper recognition, correct the proposed
text if needed, then tap **Confirm sentence**. This generates the looping
reference and returns basic voice measurements. On Results, run the experimental
phoneme model for a single word or tap **Ask Gemma for a suggestion** separately.
Those models may take longer to load. Audio is sent to the
configured Mac service automatically after recording. The Python server has no authentication or TLS,
so bind it only on a trusted local network.

The model inference for arbitrary sentences and recording analysis currently
runs on the Mac; this is a native iPhone app with a networked analysis service,
not an on-device model port. The existing Claude/demo lesson feedback remains
available separately.

If you prefer not to use XcodeGen: create a new iOS App project named MouthCoach (SwiftUI, Swift), delete its generated
`ContentView.swift` and `MouthCoachApp.swift`, drag the `MouthCoach/` folder in, and add the Info.plist keys listed in `project.yml`
(camera and microphone usage descriptions, `MouthCoachFeedbackServerURL`, `NSAppTransportSecurity`).

## How it maps to the web app

| Web (React)                           | iOS (Swift)                                   |
|---------------------------------------|-----------------------------------------------|
| `src/data/lessons.ts`                 | `Resources/lessons.json` (generated, see below) |
| `src/types.ts`                        | `Core/Models.swift`                           |
| `src/animation/shapes.ts`             | `Core/MouthShapes.swift` + `Views/MouthCanvas.swift` |
| `src/analysis/features.ts`, `summarize.ts` | `Core/MouthFeatures.swift`, `Core/Summarize.swift` |
| MediaPipe Face Landmarker             | Apple Vision `VNDetectFaceLandmarksRequest` (`Media/CameraController.swift`) |
| `MediaRecorder`, Web Audio level meter | `AVAudioRecorder` with metering (`Media/AudioRecorder.swift`) |
| Web Speech API                        | `AVSpeechSynthesizer` (`Media/SpeechPlayer.swift`) |
| Feedback providers                    | `Core/Feedback.swift`                         |
| `App.tsx` state                       | `App/AppModel.swift` (`@Observable`)          |

Lessons have one source of truth. After editing `src/data/lessons.ts`, run `npm run export:lessons` in the repository root to
refresh `ios/MouthCoach/Resources/lessons.json`.

## Claude feedback

The app never contains the Claude API key. Like the web app, it sends the lip measurements and up to four mouth-only snapshots
to the MouthCoach server (`POST /api/feedback`), which calls Claude with the key from `.env`.

- **Simulator:** the default `MouthCoachFeedbackServerURL` is `http://localhost:5173`, which reaches `npm run dev` on the same Mac.
- **iPhone on the same Wi-Fi:** run the server on your Mac with `npm run dev -- --host 0.0.0.0`, then set
  `MouthCoachFeedbackServerURL` in `project.yml` to `http://<your-mac's-IP>:5173` and regenerate.
- **App Store / TestFlight:** deploy the server handler (`server/claudeFeedback.ts`) behind HTTPS and point the URL there.

Without a reachable server, the app offers demo feedback.

## Verifying the app

Run `xcodegen generate`, then build the `MouthCoach` scheme for an iPhone
Simulator or a signed physical iPhone in Xcode. The bundled lessons should
appear without the Mac service. On a real iPhone, allow camera and microphone
access, then verify that the yellow outline follows the lips and that the blue
outline can be selected independently.

Lip measurements from Vision use outline extents, scaled to match the web app's face unit (`faceUnitPerContourWidth` in
`Core/MouthFeatures.swift`). The thresholds were tuned for MediaPipe, so check the “What the camera measured” results on a real
device and adjust that factor if needed.
