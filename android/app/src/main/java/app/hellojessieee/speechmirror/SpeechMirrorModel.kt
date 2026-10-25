package app.hellojessieee.speechmirror

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.Locale

data class TrackingSummary(val sampled: Int, val tracked: Int,
    val fraction: Double, val apertureRatio: Double?)

class SpeechMirrorModel(context: Context) {
    private val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= 31)
        context.getSystemService(VibratorManager::class.java).defaultVibrator
    else @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)
    private val prefs = context.getSharedPreferences("speech_mirror", Context.MODE_PRIVATE)
    private val api = SpeechMirrorApi()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val microphone = WavRecorder { micLevel = it }
    private val playback = WavPlayback(context) { playingRecording = false }
    private var wav: ByteArray? = null
    private var recordStarted = 0L
    private var loopJob: Job? = null
    private var analysisJob: Job? = null
    private var generation = 0
    private var captureCount = 0
    private var trackedCount = 0
    private val apertures = mutableListOf<Double>()
    private val widths = mutableListOf<Double>()
    private var visual: JSONObject? = null
    private var recordingForGuide = false

    val lessons = Lesson.load(context)
    var freeSpeechMode by mutableStateOf(true)
        private set
    var lesson by mutableStateOf(lessons.firstOrNull())
        private set
    var correctionMode by mutableStateOf(false)
        private set
    var customReference by mutableStateOf(false)
        private set
    var cameraEnabled by mutableStateOf(true)
        private set
    var address by mutableStateOf(prefs.getString("mac_address", "http://192.168.0.160:8765")!!)
        private set
    var connectionMessage by mutableStateOf<String?>(null)
        private set
    var lips by mutableStateOf<LipFrame?>(null)
        private set
    var cameraError by mutableStateOf<String?>(null)
        private set
    var isRecording by mutableStateOf(false)
        private set
    var hasRecording by mutableStateOf(false)
        private set
    var guideTakePending by mutableStateOf(false)
        private set
    var guideTakeConfirmed by mutableStateOf(false)
        private set
    var playingRecording by mutableStateOf(false)
        private set
    var recordingElapsedMs by mutableLongStateOf(0L)
        private set
    var micLevel by mutableFloatStateOf(0f)
        private set
    var busy by mutableStateOf(false)
        private set
    var busyMessage by mutableStateOf<String?>(null)
        private set
    var fullAnalysisRunning by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var phonemeError by mutableStateOf<String?>(null)
        private set
    var gemmaError by mutableStateOf<String?>(null)
        private set
    var draft by mutableStateOf("")
    var awaitingConfirmation by mutableStateOf(false)
        private set
    var confirmedText by mutableStateOf("")
        private set
    var guide by mutableStateOf<SentenceGuide?>(null)
        private set
    var guideTimeMs by mutableLongStateOf(0L)
        private set
    var guidePlaying by mutableStateOf(false)
        private set
    var guideSpeed by mutableFloatStateOf(1f)
    var guideStepMode by mutableStateOf(false)
    var guideStepIndex by mutableStateOf(0)
    var guideHaptics by mutableStateOf(true)
    var guidePageVisible by mutableStateOf(false)
    var referenceLipScale by mutableFloatStateOf(1f)
    var outlineMode by mutableStateOf(OutlineMode.BLUE)
    var trackingSummary by mutableStateOf<TrackingSummary?>(null)
        private set
    var firstAnalysis by mutableStateOf<AnalysisResult?>(null)
        private set
    var analysis by mutableStateOf<AnalysisResult?>(null)
        private set
    var phonemeAnalysis by mutableStateOf<AnalysisResult?>(null)
        private set
    var gemmaAnalysis by mutableStateOf<AnalysisResult?>(null)
        private set
    var ttsReady by mutableStateOf(false)
        private set
    private val tts = TextToSpeech(context) { status -> ttsReady = status == TextToSpeech.SUCCESS }

    val tracker = FaceTracker(context) { frame ->
        lips = frame
        if (isRecording && captureCount < 300) {
            captureCount++
            if (frame != null) {
                trackedCount++
                if (frame.width > 0.001f) apertures += (frame.aperture / frame.width).toDouble()
                widths += frame.width.toDouble()
            }
        }
    }

    val activeFrame: GuideFrame? get() = if (guideStepMode)
        guide?.frames?.getOrNull(guideStepIndex)
        else guide?.frames?.lastOrNull { it.atMs <= guideTimeMs }
    val currentWord: String? get() = guide?.let { target ->
        val index = if (guideStepMode) target.frames.getOrNull(guideStepIndex)?.wordIndex else target.wordAt(guideTimeMs)
        index?.let { target.words.getOrNull(it)?.text }
    }
    val activePose: MouthPose get() = guide?.let {
        if (guideStepMode) it.frames.getOrNull(guideStepIndex)?.shape?.pose ?: MouthShape.REST.pose
        else it.poseAt(guideTimeMs)
    } ?: MouthShape.REST.pose

    fun reportCameraError(message: String) { cameraError = message }
    fun updateCameraEnabled(enabled: Boolean) { cameraEnabled = enabled }

    fun saveAddress(value: String): Boolean = try {
        address = api.validateAddress(value)
        prefs.edit().putString("mac_address", address).apply()
        connectionMessage = "Saved. Test the connection before recording."
        true
    } catch (failure: Exception) {
        connectionMessage = failure.message ?: "Invalid address."
        false
    }

    fun testConnection() = scope.launch {
        connectionMessage = "Checking Mac service…"
        connectionMessage = try {
            withContext(Dispatchers.IO) { api.reference(address, "see me") }
            "Mac service is reachable."
        } catch (_: Exception) {
            "Could not reach the Mac service. Check the address and Wi-Fi."
        }
    }

    fun startFreeSpeech() {
        resetPractice(clearGuide = true)
        freeSpeechMode = true
        lesson = lessons.firstOrNull()
        cameraEnabled = true
        outlineMode = OutlineMode.BLUE
    }

    fun selectLesson(target: Lesson) {
        resetPractice(clearGuide = true)
        freeSpeechMode = false
        lesson = target
        correctionMode = false
        guide = target.guide()
        confirmedText = target.text
        outlineMode = OutlineMode.BOTH
        guideSpeed = 1f
        startGuide()
    }

    fun updateCorrectionMode(enabled: Boolean) {
        val target = lesson ?: return
        if (freeSpeechMode) return
        correctionMode = enabled
        guide = target.guide(enabled)
        guideTimeMs = 0
        guideStepIndex = 0
        replayGuide()
    }

    fun createGuideFromText(text: String) = scope.launch {
        val phrase = text.trim()
        if (phrase.isBlank()) { error = "Enter an English sentence."; return@launch }
        val request = generation
        busy = true
        busyMessage = "Preparing the yellow mouth guide…"
        error = null
        try {
            val reference = withContext(Dispatchers.IO) { api.reference(address, phrase) }
            if (request != generation) return@launch
            resetPractice(clearGuide = true)
            applyCustomReference(reference)
        } catch (failure: Exception) {
            error = failure.message ?: "Could not create the mouth guide."
        } finally {
            busy = false
            busyMessage = null
        }
    }

    private fun applyCustomReference(reference: SentenceGuide) {
        freeSpeechMode = true
        customReference = true
        correctionMode = false
        guide = reference
        confirmedText = reference.text
        guideTimeMs = 0
        guideStepIndex = 0
        guideSpeed = .45f
        outlineMode = OutlineMode.YELLOW
        guidePlaying = false
        startGuide()
    }

    fun startRecording() {
        if (isRecording || busy) return
        try {
            generation++
            analysisJob?.cancel()
            playback.stop()
            playingRecording = false
            wav = null
            hasRecording = false
            guideTakePending = false
            guideTakeConfirmed = false
            firstAnalysis = null
            analysis = null
            phonemeAnalysis = null
            gemmaAnalysis = null
            awaitingConfirmation = false
            draft = ""
            error = null
            phonemeError = null
            gemmaError = null
            fullAnalysisRunning = false
            busyMessage = null
            captureCount = 0
            trackedCount = 0
            apertures.clear()
            widths.clear()
            trackingSummary = null
            visual = null
            microphone.start()
            recordStarted = System.currentTimeMillis()
            recordingElapsedMs = 0
            isRecording = true
            val request = generation
            scope.launch {
                while (isRecording && request == generation) {
                    delay(100)
                    recordingElapsedMs = System.currentTimeMillis() - recordStarted
                    if (recordingElapsedMs >= 30_000) stopRecording()
                }
            }
        } catch (failure: Exception) {
            recordingForGuide = false
            error = failure.message ?: "Could not start the microphone."
        }
    }

    fun stopRecording() {
        if (!isRecording) return
        isRecording = false
        recordingElapsedMs = System.currentTimeMillis() - recordStarted
        try {
            wav = microphone.stop()
            hasRecording = true
            saveVisualSummary()
            if (recordingForGuide) {
                guideTakePending = true
                recordingForGuide = false
            } else if (confirmedText.isNotBlank()) analyzeConfirmedRecording() else recognize()
        } catch (failure: Exception) {
            error = failure.message ?: "Could not finish the recording."
        }
    }

    fun toggleRecordingPlayback() {
        if (playingRecording) { playback.stop(); playingRecording = false; return }
        val recording = wav ?: return
        try { playback.play(recording); playingRecording = true }
        catch (failure: Exception) { error = failure.message ?: "Could not play the recording." }
    }

    fun discardRecording() { resetPractice(clearGuide = false) }

    fun startGuideRecording() {
        if (guide == null || confirmedText.isBlank()) return
        recordingForGuide = true
        startRecording()
    }

    fun stopGuideRecording() = stopRecording()

    fun confirmGuideRecording() {
        if (!guideTakePending || !hasRecording) return
        playback.stop()
        playingRecording = false
        guideTakePending = false
        guideTakeConfirmed = true
        analyzeConfirmedRecording()
    }

    private fun resetPractice(clearGuide: Boolean) {
        generation++
        analysisJob?.cancel()
        playback.stop()
        playingRecording = false
        microphone.discard()
        wav = null
        isRecording = false
        hasRecording = false
        guideTakePending = false
        guideTakeConfirmed = false
        recordingForGuide = false
        recordingElapsedMs = 0
        micLevel = 0f
        firstAnalysis = null
        analysis = null
        phonemeAnalysis = null
        gemmaAnalysis = null
        awaitingConfirmation = false
        draft = ""
        error = null
        phonemeError = null
        gemmaError = null
        busy = false
        busyMessage = null
        fullAnalysisRunning = false
        trackingSummary = null
        visual = null
        if (clearGuide) {
            guidePlaying = false
            loopJob?.cancel()
            guide = null
            confirmedText = ""
            customReference = false
            correctionMode = false
            guideTimeMs = 0
            guideStepIndex = 0
        }
    }

    fun recognize() {
        val audio = wav ?: return
        val request = generation
        analysisJob?.cancel()
        analysisJob = scope.launch {
            busy = true
            busyMessage = "Recognizing speech… The first model load can take about a minute."
            error = null
            try {
                val result = withContext(Dispatchers.IO) { api.analyze(address, audio, visual = visual) }
                if (request != generation) return@launch
                firstAnalysis = result
                draft = result.heard.orEmpty()
                awaitingConfirmation = true
                if (draft.isEmpty()) error = "Whisper did not find clear words. Type what you meant to say, or record again."
            } catch (failure: Exception) {
                if (request == generation) error = failure.message ?: "Speech recognition failed."
            } finally {
                if (request == generation) { busy = false; busyMessage = null }
            }
        }
    }

    fun confirmSentence() {
        val intended = draft.trim()
        if (intended.isBlank() || wav == null) { error = "Enter the English words you meant to say."; return }
        val request = generation
        analysisJob?.cancel()
        analysisJob = scope.launch {
            awaitingConfirmation = false
            fullAnalysisRunning = true
            busy = true
            busyMessage = "Preparing the yellow mouth guide…"
            error = null
            try {
                val reference = withContext(Dispatchers.IO) { api.reference(address, intended) }
                if (request != generation) return@launch
                applyCustomReference(reference)
                runFullAnalysis(request)
            } catch (failure: Exception) {
                if (request == generation) {
                    awaitingConfirmation = guide == null
                    error = failure.message ?: "Could not create the mouth guide."
                }
            } finally {
                if (request == generation) { busy = false; busyMessage = null; fullAnalysisRunning = false }
            }
        }
    }

    fun analyzeConfirmedRecording() {
        val request = generation
        analysisJob?.cancel()
        analysisJob = scope.launch {
            fullAnalysisRunning = true
            busy = true
            error = null
            try { runFullAnalysis(request) }
            catch (failure: Exception) { if (request == generation) error = failure.message ?: "Full analysis failed." }
            finally { if (request == generation) { busy = false; busyMessage = null; fullAnalysisRunning = false } }
        }
    }

    private suspend fun runFullAnalysis(request: Int) {
        val audio = wav ?: return
        val intended = confirmedText
        busyMessage = "Measuring your recording…"
        val basic = withContext(Dispatchers.IO) { api.analyze(address, audio, intended = intended, visual = visual) }
        if (request != generation) return
        analysis = basic
        busyMessage = "Comparing tentative phonemes…"
        try { runPhonemesStage(audio, intended, request) }
        catch (failure: Exception) { if (request == generation) phonemeError = failure.message ?: "Phoneme analysis was unavailable." }
        if (request != generation) return
        busyMessage = "Gemma is preparing your practice suggestion…"
        try { runGemmaStage(audio, intended, request) }
        catch (failure: Exception) { if (request == generation) gemmaError = failure.message ?: "Gemma was unavailable." }
    }

    fun runPhonemes() {
        val audio = wav ?: return
        val request = generation
        scope.launch {
            busy = true
            busyMessage = "The experimental phoneme model is running…"
            phonemeError = null
            try { runPhonemesStage(audio, confirmedText, request) }
            catch (failure: Exception) { if (request == generation) phonemeError = failure.message ?: "Phoneme analysis failed." }
            finally { if (request == generation) { busy = false; busyMessage = null } }
        }
    }

    private suspend fun runPhonemesStage(audio: ByteArray, intended: String, request: Int) {
        val result = withContext(Dispatchers.IO) {
            api.analyze(address, audio, intended = intended, phonemes = true, visual = visual)
        }
        if (request == generation) phonemeAnalysis = result
    }

    fun runGemma() {
        val audio = wav ?: return
        val request = generation
        scope.launch {
            busy = true
            busyMessage = "Gemma is reviewing the measured evidence…"
            gemmaError = null
            try { runGemmaStage(audio, confirmedText, request) }
            catch (failure: Exception) { if (request == generation) gemmaError = failure.message ?: "Gemma was unavailable." }
            finally { if (request == generation) { busy = false; busyMessage = null } }
        }
    }

    private suspend fun runGemmaStage(audio: ByteArray, intended: String, request: Int) {
        val result = withContext(Dispatchers.IO) {
            api.analyze(address, audio, intended = intended, gemma = true,
                phonemes = phonemeAnalysis?.phoneStatus == "tentative", visual = visual)
        }
        if (request == generation) gemmaAnalysis = result
    }

    fun toggleGuide() {
        if (guidePlaying) { guidePlaying = false; loopJob?.cancel() }
        else startGuide()
    }

    fun replayGuide() {
        guidePlaying = false
        loopJob?.cancel()
        guideTimeMs = 0
        startGuide()
    }

    fun seekGuide(toMs: Long) { guideTimeMs = toMs.coerceIn(0, guide?.durationMs ?: 0) }

    private fun startGuide() {
        if (guide == null || guidePlaying) return
        loopJob?.cancel()
        guidePlaying = true
        loopJob = scope.launch {
            var previous = System.currentTimeMillis()
            var previousFrame = -1
            while (guidePlaying) {
                delay(16)
                val now = System.currentTimeMillis()
                val duration = guide?.durationMs ?: break
                guideTimeMs = if (duration > 0) (guideTimeMs + ((now - previous) * guideSpeed).toLong()) % duration else 0
                val frame = guide?.frames?.indexOfLast { it.atMs <= guideTimeMs } ?: -1
                if (guideHaptics && guidePageVisible && frame != previousFrame && frame > 0) {
                    vibrator.vibrate(VibrationEffect.createOneShot(12, 60))
                }
                previousFrame = frame
                previous = now
            }
        }
    }

    fun speakReference() {
        if (!ttsReady || confirmedText.isBlank()) return
        tts.language = Locale.US
        tts.setSpeechRate(if (guideSpeed < 1f) .75f else 1f)
        tts.speak(confirmedText, TextToSpeech.QUEUE_FLUSH, null, "speechly-reference")
    }

    private fun saveVisualSummary() {
        if (captureCount == 0) return
        fun median(values: List<Double>): Double? = values.sorted().takeIf { it.isNotEmpty() }?.let { it[it.size / 2] }
        val fraction = trackedCount.toDouble() / captureCount
        val aperture = median(apertures)
        trackingSummary = TrackingSummary(captureCount, trackedCount, fraction, aperture)
        visual = JSONObject().apply {
            put("sampled_frames", captureCount)
            put("tracked_frames", trackedCount)
            put("tracked_fraction", fraction)
            put("median_aperture_ratio", aperture ?: JSONObject.NULL)
            put("median_width_ratio", median(widths) ?: JSONObject.NULL)
        }
    }

    fun close() {
        analysisJob?.cancel()
        microphone.discard()
        playback.stop()
        tts.shutdown()
        tracker.close()
        scope.cancel()
    }
}

enum class OutlineMode(val title: String) { YELLOW("Yellow"), BLUE("Blue"), BOTH("Both") }
