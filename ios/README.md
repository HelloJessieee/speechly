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

## Verifying the shared core without a Mac

`Core/` uses only Foundation, so it builds anywhere Swift does. `CoreChecks/` holds checks for lesson decoding, the mouth geometry,
the analysis and the feedback JSON:

```bash
cd ios
swiftc -swift-version 5 MouthCoach/Core/*.swift CoreChecks/main.swift -o corechecks
./corechecks MouthCoach/Resources/lessons.json
```

Lip measurements from Vision use outline extents, scaled to match the web app's face unit (`faceUnitPerContourWidth` in
`Core/MouthFeatures.swift`). The thresholds were tuned for MediaPipe, so check the “What the camera measured” results on a real
device and adjust that factor if needed.
