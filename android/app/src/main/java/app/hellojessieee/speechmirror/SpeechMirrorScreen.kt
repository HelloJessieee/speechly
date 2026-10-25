package app.hellojessieee.speechmirror

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.key
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import kotlinx.coroutines.launch
import java.util.Locale

private val Ink = Color(0xFF263A37)
private val SoftInk = Color(0xFF60726C)
private val Sage = Color(0xFF315F55)
private val Paper = Color(0xFFF8F7F2)
private val Warm = Color(0xFFF4E9D5)

@Composable
fun SpeechMirrorScreen(model: SpeechMirrorModel, cameraAllowed: Boolean, audioAllowed: Boolean,
    requestPermissions: () -> Unit) {
    val pager = rememberPagerState(pageCount = { 3 })
    val scope = rememberCoroutineScope()
    var showSettings by remember { mutableStateOf(false) }
    var showLessons by remember { mutableStateOf(false) }
    LaunchedEffect(model.guide) {
        if (model.guide != null) pager.animateScrollToPage(1)
    }
    LaunchedEffect(model.guideTakeConfirmed) {
        if (model.guideTakeConfirmed) pager.animateScrollToPage(2)
    }
    LaunchedEffect(pager.currentPage) { model.guidePageVisible = pager.currentPage == 1 }
    MaterialTheme(colorScheme = lightColorScheme(primary = Sage, onPrimary = Color.White,
        background = Paper, surface = Color.White, onSurface = Ink, secondary = Color(0xFF9A6537))) {
        Scaffold(containerColor = Paper, topBar = {
            Column(Modifier.background(Paper)) {
                Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 18.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Image(painterResource(R.drawable.speechly_icon), "Speechly icon",
                        Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)))
                    Text("Speechly", Modifier.padding(start = 10.dp),
                        style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.weight(1f))
                    Box {
                        TextButton(onClick = { showLessons = true }) {
                            Text((if (model.freeSpeechMode) "Free speech" else model.lesson?.text ?: "Lesson") + " ⌄",
                                maxLines = 1, fontSize = 12.sp)
                        }
                        DropdownMenu(expanded = showLessons, onDismissRequest = { showLessons = false }) {
                            DropdownMenuItem(text = { Text("Free speech") }, onClick = {
                                model.startFreeSpeech(); showLessons = false; scope.launch { pager.animateScrollToPage(0) }
                            })
                            model.lessons.forEach { lesson ->
                                DropdownMenuItem(text = { Text(lesson.text) }, onClick = {
                                    model.selectLesson(lesson); showLessons = false
                                    scope.launch { pager.animateScrollToPage(1) }
                                })
                            }
                        }
                    }
                    TextButton(onClick = { showSettings = true }) { Text("⚙", fontSize = 21.sp) }
                }
                if (model.busy) Row(Modifier.fillMaxWidth().background(Color(0xFFEAF2E8))
                    .padding(horizontal = 18.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    Text(model.busyMessage ?: "Working…", style = MaterialTheme.typography.bodySmall,
                        color = Sage)
                }
            }
        }, bottomBar = {
            Row(Modifier.fillMaxWidth().background(Color.White).navigationBarsPadding()
                .padding(horizontal = 10.dp, vertical = 8.dp)) {
                listOf("Practice", "Mouth Guide", "Results").forEachIndexed { index, label ->
                    TextButton(onClick = { scope.launch { pager.animateScrollToPage(index) } },
                        modifier = Modifier.weight(1f)) {
                        Text(label, color = if (pager.currentPage == index) Sage else SoftInk,
                            fontWeight = if (pager.currentPage == index) FontWeight.Bold else FontWeight.Normal,
                            fontSize = 12.sp, textAlign = TextAlign.Center)
                    }
                }
            }
        }) { padding ->
            HorizontalPager(pager, Modifier.fillMaxSize().padding(padding)) { page ->
                key(page) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        when (page) {
                            0 -> PracticePage(model, cameraAllowed, audioAllowed,
                                pager.currentPage == 0, requestPermissions)
                            1 -> GuidePage(model, cameraAllowed,
                                audioAllowed, pager.currentPage == 1, requestPermissions)
                            else -> ResultsPage(model)
                        }
                        Text("Reference shapes and model predictions are practice aids, not proof of correct pronunciation.",
                            style = MaterialTheme.typography.bodySmall, color = SoftInk,
                            modifier = Modifier.padding(bottom = 12.dp))
                    }
                }
            }
        }
        if (showSettings) ConnectionDialog(model, onDismiss = { showSettings = false })
    }
}

@Composable
private fun PageHeading(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = SoftInk)
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title.uppercase(Locale.US), color = Sage, style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            content()
        }
    }
}

@Composable
private fun Status(model: SpeechMirrorModel) {
    if (model.busy) Row(verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        Text(model.busyMessage ?: "Working…", style = MaterialTheme.typography.bodySmall)
    }
    model.error?.let { Text(it, color = Color(0xFF9A4B2D), style = MaterialTheme.typography.bodySmall) }
}

@Composable
private fun PracticePage(model: SpeechMirrorModel, cameraAllowed: Boolean, audioAllowed: Boolean,
    active: Boolean, requestPermissions: () -> Unit) {
    PageHeading("Start", "Record a guess or type the sentence.")
    Section("Your words") {
        if (model.customReference) {
            Text(model.confirmedText, style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold)
            Text("Your mouth guide is ready.", color = SoftInk)
            OutlinedButton(onClick = model::startFreeSpeech) { Text("Start a new sentence") }
        } else {
            var typedSentence by remember { mutableStateOf("") }
            OutlinedTextField(typedSentence, onValueChange = { typedSentence = it },
                label = { Text("Type what you want to say") }, modifier = Modifier.fillMaxWidth())
            Button(onClick = { model.createGuideFromText(typedSentence) },
                enabled = typedSentence.isNotBlank() && !model.busy) { Text("Create mouth guide") }
            Text("Or record below for a text guess.", color = SoftInk)
            if (model.busy && model.busyMessage?.contains("guide") == true) Status(model)
        }
    }
    Section("Live mouth mirror") {
        if (cameraAllowed && model.cameraEnabled) {
            CameraMouthGuide(model.tracker, model.lips, model.activePose,
                if (model.guide == null) OutlineMode.BLUE else model.outlineMode,
                model.referenceLipScale, active,
                Modifier.fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(16.dp)))
            Text(if (model.lips == null) "Finding your lips…" else "Lips tracked",
                color = SoftInk, style = MaterialTheme.typography.bodySmall)
        } else if (!cameraAllowed) {
            OutlinedButton(onClick = requestPermissions) { Text("Allow camera") }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Camera", Modifier.weight(1f))
            Switch(model.cameraEnabled, onCheckedChange = model::updateCameraEnabled)
        }
        if (model.guide != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlineMode.entries.forEach { mode ->
                    FilterChip(selected = model.outlineMode == mode,
                        onClick = { model.outlineMode = mode }, label = { Text(mode.title) })
                }
            }
            Text("Speaking: ${model.currentWord ?: "pause"}", color = Sage, fontWeight = FontWeight.Bold)
        }
        model.cameraError?.let { Text(it, color = Color(0xFF9A4B2D)) }
    }
    Section("Your recording") {
        Text(if (model.confirmedText.isBlank())
            "Record an English sentence. Whisper on your Mac will suggest the words automatically."
            else "Record the sentence again. The confirmed words will be analyzed automatically.",
            style = MaterialTheme.typography.bodyMedium)
        if (!audioAllowed) {
            OutlinedButton(onClick = requestPermissions) { Text("Allow microphone") }
        } else {
            Button(onClick = { if (model.isRecording) model.stopRecording() else model.startRecording() },
                enabled = !model.busy) {
                Text(if (model.isRecording) "Stop recording" else "Start recording")
            }
            if (model.isRecording) {
                Text("Recording… ${format(model.recordingElapsedMs / 1000.0)} / 30 s", color = Color(0xFF9A4B2D))
                Slider(value = model.micLevel.coerceIn(0f, 1f), onValueChange = {}, enabled = false)
            }
            if (model.hasRecording && !model.isRecording) {
                Text("Recording ready · ${format(model.recordingElapsedMs / 1000.0)} s", color = Sage)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = model::toggleRecordingPlayback) {
                        Text(if (model.playingRecording) "Stop playback" else "Play recording")
                    }
                    TextButton(onClick = model::discardRecording) { Text("Discard") }
                }
                if (!model.busy && !model.awaitingConfirmation && model.firstAnalysis == null) {
                    OutlinedButton(onClick = model::recognize) { Text("Retry recognition") }
                }
            }
        }
        Status(model)
    }
    model.trackingSummary?.let { summary ->
        Section("Camera tracking") {
            Text("Tracked ${(summary.fraction * 100).toInt()}% of ${summary.sampled} sampled frames.")
            summary.apertureRatio?.let { Text("Median mouth opening ratio: ${format(it)}") }
        }
    }
    Section("Transcript") {
        if (model.awaitingConfirmation) {
            Text("Whisper heard", color = SoftInk, style = MaterialTheme.typography.labelMedium)
            Text(model.firstAnalysis?.heard ?: "No clear words detected",
                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text("Whisper can be wrong. Edit this to match what you intended to say.", color = SoftInk)
            OutlinedTextField(value = model.draft, onValueChange = { model.draft = it },
                label = { Text("What you meant to say") }, singleLine = false,
                modifier = Modifier.fillMaxWidth())
            Button(onClick = model::confirmSentence, enabled = !model.busy && model.draft.isNotBlank()) {
                Text("Confirm sentence")
            }
        } else if (model.confirmedText.isNotBlank()) {
            Text("Confirmed sentence", color = SoftInk, style = MaterialTheme.typography.labelMedium)
            Text(model.confirmedText, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("Swipe to Mouth Guide for the looping reference.", color = SoftInk)
        } else {
            Text("Your editable transcript appears here after recording.", color = SoftInk)
        }
    }
    Section("Mac service") {
        Text(model.address, style = MaterialTheme.typography.bodySmall)
        Text("Your recording goes to the Mac after you stop. You can change the address in Connection.",
            color = SoftInk, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun GuidePage(model: SpeechMirrorModel, cameraAllowed: Boolean, audioAllowed: Boolean,
    active: Boolean,
    requestPermissions: () -> Unit) {
    PageHeading("Mouth Guide", "Follow the looping sentence, one word at a time.")
    val guide = model.guide
    if (guide == null) {
        Section("Your guide will appear here") {
            Text("Record or type a sentence on Start.", color = SoftInk)
        }
        return
    }
    val wordIndex = if (model.guideStepMode) guide.frames.getOrNull(model.guideStepIndex)?.wordIndex
        else guide.wordAt(model.guideTimeMs)
    Section("Reference sentence") {
        Text(buildAnnotatedString {
            guide.words.forEachIndexed { index, word ->
                if (index > 0) append(" ")
                withStyle(SpanStyle(color = if (index == wordIndex) Sage else Ink,
                    fontWeight = if (index == wordIndex) FontWeight.Bold else FontWeight.Normal,
                    background = if (index == wordIndex) Warm else Color.Transparent)) {
                    append(word.text)
                }
            }
        }, style = MaterialTheme.typography.titleLarge)
        ReferenceMouth(model.activePose,
            modifier = Modifier.fillMaxWidth().height(155.dp).clip(RoundedCornerShape(16.dp)).background(Warm))
        Text("Speaking: ${wordIndex?.let { guide.words[it].text } ?: "pause"}",
            color = Sage, fontWeight = FontWeight.Bold)
        model.activeFrame?.let { frame ->
            if (frame.caption.isNotBlank()) Text(frame.caption, color = SoftInk)
            frame.sound?.let { Text(it, color = Sage) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = model::toggleGuide) { Text(if (model.guidePlaying) "Pause" else "Play") }
            OutlinedButton(onClick = model::replayGuide) { Text("Replay") }
            OutlinedButton(onClick = model::speakReference, enabled = model.ttsReady) { Text("Hear it") }
        }
        Text("Speed", fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("Normal" to 1f, "Slow" to .7f, "Slower" to .45f).forEach { (name, speed) ->
                FilterChip(selected = model.guideSpeed == speed,
                    onClick = { model.guideSpeed = speed }, label = { Text(name) })
            }
        }
        Slider(value = model.guideTimeMs.toFloat(),
            onValueChange = { model.seekGuide(it.toLong()) },
            valueRange = 0f..guide.durationMs.coerceAtLeast(1).toFloat())
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Step by step", Modifier.weight(1f))
            Switch(model.guideStepMode, onCheckedChange = {
                model.guideStepMode = it
                if (it && model.guidePlaying) model.toggleGuide()
            })
        }
        if (model.guideStepMode) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { model.guideStepIndex = (model.guideStepIndex - 1).coerceAtLeast(0) }) {
                    Text("Previous")
                }
                Text("${model.guideStepIndex + 1} / ${guide.frames.size}",
                    Modifier.align(Alignment.CenterVertically))
                OutlinedButton(onClick = { model.guideStepIndex =
                    (model.guideStepIndex + 1).coerceAtMost(guide.frames.lastIndex) }) { Text("Next") }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Haptic cues", Modifier.weight(1f))
            Switch(model.guideHaptics, onCheckedChange = { model.guideHaptics = it })
        }
    }
    Section("On your lips") {
        Text("Compare the yellow guide with your own mouth.", color = SoftInk)
        if (cameraAllowed) {
            CameraMouthGuide(model.tracker, model.lips, model.activePose, OutlineMode.YELLOW,
                model.referenceLipScale, active,
                Modifier.fillMaxWidth().aspectRatio(3f / 4f).clip(RoundedCornerShape(20.dp)))
            Text("Reference word: ${wordIndex?.let { guide.words[it].text } ?: "pause"}",
                color = Sage, fontWeight = FontWeight.Bold)
            if (model.lips == null) Text("The yellow outline will attach and resize when your lips are detected.",
                color = SoftInk, style = MaterialTheme.typography.bodySmall)
        } else {
            OutlinedButton(onClick = requestPermissions) { Text("Allow camera") }
        }
        model.cameraError?.let { Text(it, color = Color(0xFF9A4B2D)) }
        Text("Adjust the yellow outline to your lips: ${(model.referenceLipScale * 100).toInt()}%")
        Slider(value = model.referenceLipScale, onValueChange = { model.referenceLipScale = it },
            valueRange = .65f..1.35f)
    }
    if (model.customReference) Section("Your turn") {
        Text(if (model.guideTakeConfirmed) "Record another take whenever you're ready."
            else "Follow the mouth guide, then record your attempt.",
            fontWeight = FontWeight.SemiBold)
        when {
            model.isRecording -> {
                Text("Recording · ${format(model.recordingElapsedMs / 1000.0)} s")
                Slider(model.micLevel.coerceIn(0f, 1f), onValueChange = {}, enabled = false)
                Button(onClick = model::stopGuideRecording) { Text("Stop") }
            }
            model.guideTakePending -> {
                Text("Use this take?", fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = model::toggleRecordingPlayback) {
                        Text(if (model.playingRecording) "Stop playback" else "Listen")
                    }
                    Button(onClick = model::confirmGuideRecording) { Text("Use this take") }
                }
                TextButton(onClick = model::startGuideRecording) { Text("Record again") }
            }
            !audioAllowed -> OutlinedButton(onClick = requestPermissions) { Text("Allow microphone") }
            else -> Button(onClick = model::startGuideRecording, enabled = !model.busy) {
                Text(if (model.guideTakeConfirmed) "Record another take" else "Record attempt")
            }
        }
        Status(model)
    }
    if (!model.freeSpeechMode) {
        model.lesson?.let { lesson -> Section("Lesson guide") {
            Text(lesson.respelling, fontWeight = FontWeight.Bold)
            Text(lesson.ipa, color = SoftInk)
            Text(lesson.explanation)
            Text(lesson.tip, color = Sage)
            lesson.note?.let { Text(it, color = SoftInk) }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Correction", Modifier.weight(1f))
                Switch(model.correctionMode, onCheckedChange = model::updateCorrectionMode)
            }
            if (model.correctionMode) Text(lesson.correctionInstruction)
        } }
    }
    if (model.freeSpeechMode) {
        Section("Use a different sentence") {
            var customText by remember { mutableStateOf("") }
            OutlinedTextField(customText, onValueChange = { customText = it },
                label = { Text("English sentence") }, modifier = Modifier.fillMaxWidth())
            OutlinedButton(onClick = { model.createGuideFromText(customText) },
                enabled = customText.isNotBlank() && !model.busy) { Text("Make mouth guide") }
        }
    }
}

@Composable
private fun ResultsPage(model: SpeechMirrorModel) {
    PageHeading("Results", "Review the model's guesses and your next practice step.")
    if (model.awaitingConfirmation || model.analysis == null) {
        Section("Speech analysis") {
            Text(if (model.busy) model.busyMessage ?: "Analyzing your recording…"
                else "Record and confirm a sentence on Practice. Your results will appear here.", color = SoftInk)
            if (model.hasRecording && model.confirmedText.isNotBlank() && !model.busy) {
                Button(onClick = model::analyzeConfirmedRecording) { Text("Retry full analysis") }
            }
            Status(model)
        }
        return
    }
    val result = model.analysis ?: return
    if (model.hasRecording && !model.busy) {
        OutlinedButton(onClick = model::analyzeConfirmedRecording) { Text("Run full analysis again") }
    }
    Section("Words") {
        Text("Whisper heard: ${result.heard ?: "No clear words"}")
        Text("You meant: ${model.confirmedText}", fontWeight = FontWeight.Bold)
        result.comparison?.let { Text(english(it, "Whisper's guess may differ from your confirmed words.")) }
        Text("Whisper is a tentative guess, not a pronunciation score.", color = SoftInk,
            style = MaterialTheme.typography.bodySmall)
    }
    Section("Voice measurements") {
        Text("Recording ${format(result.duration)} s · Voiced ${format(result.voiced)} s")
        Text("Average level ${format(result.rmsDbfs)} dBFS")
        result.medianPitch?.let { Text("Median pitch ${it.toInt()} Hz") }
        Text(if (result.usable) "Signal usable for comparison" else "Signal too weak for reliable comparison",
            color = if (result.usable) Sage else Color(0xFF9A4B2D))
        if (result.pitch.isNotEmpty()) {
            Text("Pitch trace", fontWeight = FontWeight.SemiBold)
            TraceChart(result.pitch, Color(0xFF7B78BA), Modifier.fillMaxWidth().height(105.dp))
        }
        if (result.volume.isNotEmpty()) {
            Text("Volume trace", fontWeight = FontWeight.SemiBold)
            TraceChart(result.volume, Sage, Modifier.fillMaxWidth().height(105.dp))
        }
    }
    val phones = model.phonemeAnalysis ?: result
    Section("Phoneme model") {
        Text(if (phones.phoneStatus == "tentative") "Tentative phoneme guess" else "Phoneme comparison has not run or was unavailable")
        if (phones.phoneModel.isNotBlank()) Text("Model: ${phones.phoneModel}", color = SoftInk)
        if (phones.phoneReason.isNotBlank()) Text(english(phones.phoneReason,
            "The phoneme model could not compare this recording."), color = SoftInk)
        if (phones.targetPhones.isNotEmpty()) Text("Target: /${phones.targetPhones.joinToString(" ")}/")
        if (phones.predictedPhones.isNotEmpty()) Text("Model heard: /${phones.predictedPhones.joinToString(" ")}/")
        phones.phoneDifferences.forEach {
            Text("Possible ${it.type}: ${it.expected ?: "—"} → ${it.observed ?: "—"}")
        }
        Text("Differences may reflect model error or accent; they are not a score.",
            color = SoftInk, style = MaterialTheme.typography.bodySmall)
        if (model.phonemeAnalysis == null) {
            OutlinedButton(onClick = model::runPhonemes, enabled = !model.busy) {
                Text("Retry phoneme model")
            }
        }
        model.phonemeError?.let { Text(it, color = Color(0xFF9A4B2D)) }
    }
    if (phones.targetPhones.isNotEmpty()) Section("3D articulation practice") {
        ArticulationCoach(phones)
    }
    val suggestion = model.gemmaAnalysis ?: result
    Section(if (model.gemmaAnalysis != null && suggestion.coachSource == "gemma_local") "Gemma suggestion" else "Practice suggestion") {
        Text(english(suggestion.feedback,
            "Replay the recording, say one word separately, then return to the full sentence."),
            fontWeight = FontWeight.SemiBold)
        Text(english(suggestion.nextExercise, "Record the same sentence once more and compare."), color = SoftInk)
        if (suggestion.coachReason.isNotBlank()) Text(english(suggestion.coachReason,
            "The suggestion is based on available measurements."), color = SoftInk)
        OutlinedButton(onClick = model::runGemma, enabled = !model.busy) {
            Text("Retry Gemma suggestion")
        }
        model.gemmaError?.let { Text(it, color = Color(0xFF9A4B2D)) }
        Status(model)
    }
}

@Composable
private fun TraceChart(points: List<PlotPoint>, color: Color, modifier: Modifier) {
    Canvas(modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFFF4F6F2))) {
        val visible = points.filter { it.value != null }
        if (visible.size < 2) return@Canvas
        val minX = visible.minOf { it.time }
        val maxX = visible.maxOf { it.time }.coerceAtLeast(minX + .01f)
        val minY = visible.minOf { it.value!! }
        val maxY = visible.maxOf { it.value!! }.coerceAtLeast(minY + .01f)
        val path = Path()
        visible.forEachIndexed { index, point ->
            val x = ((point.time - minX) / (maxX - minX)) * size.width
            val y = size.height - ((point.value!! - minY) / (maxY - minY)) * size.height
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, color, style = androidx.compose.ui.graphics.drawscope.Stroke(
            width = 2.dp.toPx(), cap = StrokeCap.Round))
    }
}

@Composable
private fun ConnectionDialog(model: SpeechMirrorModel, onDismiss: () -> Unit) {
    var draftAddress by remember { mutableStateOf(model.address) }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Mac connection") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Your Pixel sends recordings to this Mac for Whisper, phoneme analysis, and Gemma suggestions.")
                OutlinedTextField(value = draftAddress, onValueChange = { draftAddress = it },
                    label = { Text("http://Mac-IP:8765") }, singleLine = true)
                model.connectionMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                OutlinedButton(onClick = model::testConnection) { Text("Test saved connection") }
            }
        }, confirmButton = {
            Button(onClick = { if (model.saveAddress(draftAddress)) onDismiss() }) { Text("Save address") }
        }, dismissButton = { TextButton(onClick = onDismiss) { Text("Done") } })
}

private fun english(value: String, fallback: String): String =
    if (value.any { it.code in 0x3400..0x9FFF }) fallback else value

private fun format(number: Double): String = String.format(Locale.US, "%.1f", number)
