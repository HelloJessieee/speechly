# Speechly for Android

This is the native Kotlin and Jetpack Compose Pixel app. It mirrors the current
iOS app's three swipeable pages: **Practice**, **Mouth Guide**, and **Results**.
The app records 16 kHz WAV audio, tracks lip contours with CameraX and bundled
ML Kit face detection, and connects to the Mac service on port 8765 for sentence
references, Whisper transcription, voice measurements, experimental phonemes,
and Gemma suggestions. Model weights remain on the Mac.

## Open and run

Open `android/` in Android Studio. Select the `app` run configuration and a
connected Pixel with USB debugging enabled. Grant camera and microphone
permissions. Start the Mac service using
[mac_service/README.md](../mac_service/README.md). Enter the service address
in the app's settings button and use **Test saved connection**.

For USB debugging when local Wi-Fi traffic is blocked:

```bash
adb reverse tcp:8765 tcp:8765
```

Set the app address to `http://127.0.0.1:8765`. Without USB reverse, use
`http://<Mac LAN IP>:8765` on a network that allows devices to connect.
The current development default is `http://192.168.0.160:8765`.

Build from a terminal with the Android SDK and JDK configured:

```bash
cd android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Choose Free speech or one of six lessons in the header. On **Practice**, type
an English sentence to create a guide directly, or record speech and confirm
Whisper's editable text guess. The
camera shows measured blue lips and, once a guide exists, a selectable yellow
reference. Another recording of a confirmed sentence can run analysis directly.
**Mouth Guide** loops the whole sentence with word highlighting, speech
playback, speed and step controls, haptics, and a yellow outline that follows
lip position and size. The yellow size slider allows adjustment. For a typed
sentence, record an attempt on this page, listen, and confirm the take to run
analysis. **Results**
shows tentative words, voice traces, phoneme comparison, 3D articulation poses,
and the Gemma suggestion. Phoneme and Gemma stages run automatically after
confirmation and can be retried separately.

Reference shapes and model predictions are practice aids, not proof of
correct pronunciation.
