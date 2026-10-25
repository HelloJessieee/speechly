# Speechly for iOS

A native SwiftUI version of Speechly for iPhone and iPad (iOS 17+). It follows the web app's design: the same lessons,
mouth animation, practice flow, landmark measurements and feedback, with Liquid Glass styling on iOS 26.
The Xcode project, scheme, and source folder still use the technical name `MouthCoach`.

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

## Speechly integration

The native iPhone app has three horizontally swipeable pages: **Start** for
typing or recording to get a transcript guess; **Mouth Guide** for the looping
sentence reference, live lip overlay, and a separate practice recording; and **Results** for voice measurements,
tentative phoneme comparison, an offline Articulation Studio 3D target pose,
and Gemma suggestions. The pages also have a
bottom navigation bar. All app-facing labels and analysis messages are English.

The app uses the sentence reference and audio analysis in `mac_service/`
without replacing this app's SwiftUI camera, recorder, or seven mouth shapes.
Mouth Guide shows only the yellow looping reference contour, attached to the
detected lip center and scaled to lip width. Start can also show the blue
measured outline. The current reference word is shown beside the guide. These
visual shapes and timing are illustrative.

Preset lessons and live lip tracking run on the iPhone. For an arbitrary English
sentence or Whisper / phoneme / Gemma analysis, set up and start the included
Python service on the Mac (see [mac_service/README.md](../mac_service/README.md)):

```bash
cd mac_service
.venv/bin/python -m speech_mirror.web --host 0.0.0.0 --port 8765
```

This test build defaults to `http://192.168.0.160:8765` for Speechly requests.
Open the gear icon in the app and save your Mac's current LAN address with port
8765 if it differs. Both devices must be
on the same trusted network. On Start, type an English phrase directly or record
an initial clip, correct Whisper's proposed words, then tap **Use these words**.
This generates the looping reference and immediately analyzes the confirmed
initial clip. If you typed the phrase instead, record on Mouth Guide, listen
or record again, then tap **Use this take** to start voice
measurements, an experimental phoneme comparison for phrases of up to ten words
and 30 target phonemes, and a Gemma practice suggestion.
Return to Mouth Guide and repeat with another take whenever you want.
Results appear in stages while the larger models load. The phoneme stage uses
the local L2-ARCTIC fine-tuned candidate when its checkpoint is present; its
held-out test report is still pending, so its differences remain tentative.
The 3D target animation uses the bundled Articulation Studio rig. In Results,
drag the model to rotate it, select a word to replay its supported mouth and
tongue movements, or select a sound to inspect one pose. It is an illustration, not a
measurement of the learner's tongue or teeth. Gemma runs on the Mac GPU with
thinking disabled and starts warming when the Mac service starts.
The yellow guide matches the detected mouth width at rest, has a size control,
defaults to slow playback, and gives a light haptic pulse when the reference
mouth step changes. Audio is sent to the
configured Mac service automatically after recording. The Python server has no authentication or TLS,
so bind it only on a trusted local network.

The model inference for arbitrary sentences and recording analysis currently
runs on the Mac; this is a native iPhone app with a networked analysis service,
not an on-device model port.

If you prefer not to use XcodeGen: create a new iOS App project named MouthCoach (SwiftUI, Swift), delete its generated
`ContentView.swift` and `MouthCoachApp.swift`, drag the `MouthCoach/` folder in, and add the Info.plist keys listed in `project.yml`
(camera and microphone usage descriptions and `NSAppTransportSecurity`).

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

## Verifying the app

Run `xcodegen generate`, then build the `MouthCoach` scheme for an iPhone
Simulator or a signed physical iPhone in Xcode. The bundled lessons should
appear without the Mac service. On a real iPhone, allow camera and microphone
access, then verify that the yellow outline follows the lips and that the blue
outline can be selected independently.

Lip measurements from Vision use outline extents, scaled to match the web app's face unit (`faceUnitPerContourWidth` in
`Core/MouthFeatures.swift`). The thresholds were tuned for MediaPipe, so check the “What the camera measured” results on a real
device and adjust that factor if needed.
