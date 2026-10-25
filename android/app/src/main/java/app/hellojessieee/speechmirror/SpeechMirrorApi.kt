package app.hellojessieee.speechmirror

import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class PlotPoint(val time: Float, val value: Float?)
data class PhoneDifference(val type: String, val expected: String?, val observed: String?)
data class AnalysisResult(
    val heard: String?, val asrStatus: String, val usable: Boolean,
    val duration: Double, val voiced: Double, val rmsDbfs: Double, val medianPitch: Double?,
    val comparison: String?, val coachSource: String, val feedback: String, val nextExercise: String,
    val phoneStatus: String, val targetPhones: List<String>, val predictedPhones: List<String>,
    val phoneDifferences: List<PhoneDifference>, val pitch: List<PlotPoint>, val volume: List<PlotPoint>,
    val phoneReason: String, val phoneModel: String, val coachReason: String,
) {
    companion object {
        fun fromJson(json: JSONObject): AnalysisResult {
            val measures = json.getJSONObject("measurements")
            val phone = json.getJSONObject("phoneme_assessment")
            val coach = json.getJSONObject("coach")
            val visuals = json.getJSONObject("visual_data")
            val differences = phone.optJSONArray("possible_substitutions") ?: JSONArray()
            fun optionalString(source: JSONObject, key: String): String? =
                if (source.isNull(key)) null else source.optString(key).ifBlank { null }
            fun strings(array: JSONArray?): List<String> = array?.let { (0 until it.length()).map(it::getString) } ?: emptyList()
            fun trace(key: String, field: String): List<PlotPoint> {
                val points = visuals.optJSONArray(key) ?: return emptyList()
                return (0 until points.length()).map { index ->
                    val p = points.getJSONObject(index)
                    PlotPoint(p.optDouble("time_s", 0.0).toFloat(),
                        if (p.isNull(field)) null else p.optDouble(field).toFloat())
                }
            }
            return AnalysisResult(
                heard = json.optJSONObject("asr")?.let {
                    if (it.isNull("text")) null else it.optString("text").ifBlank { null }
                },
                asrStatus = json.optJSONObject("asr")?.optString("status") ?: "not_run",
                usable = json.getJSONObject("audio_quality").optBoolean("usable"),
                duration = measures.optDouble("duration_s"), voiced = measures.optDouble("voiced_duration_s"),
                rmsDbfs = measures.optDouble("rms_dbfs"),
                medianPitch = if (measures.isNull("median_f0_hz")) null else measures.optDouble("median_f0_hz"),
                comparison = json.optJSONObject("intent")?.let { optionalString(it, "comparison") },
                coachSource = coach.optString("source"), feedback = coach.optString("feedback"),
                nextExercise = coach.optString("next_exercise"), phoneStatus = phone.optString("status"),
                targetPhones = strings(phone.optJSONArray("target")),
                predictedPhones = strings(phone.optJSONArray("predicted")),
                phoneDifferences = (0 until differences.length()).map { index ->
                    differences.getJSONObject(index).let {
                        PhoneDifference(it.optString("type"), optionalString(it, "expected"),
                            optionalString(it, "observed"))
                    }
                },
                pitch = trace("pitch_trace", "f0_hz"), volume = trace("volume_trace", "dbfs"),
                phoneReason = optionalString(phone, "reason").orEmpty(),
                phoneModel = optionalString(phone, "model").orEmpty(),
                coachReason = optionalString(coach, "reason").orEmpty(),
            )
        }
    }
}

class SpeechMirrorApi {
    fun validateAddress(value: String): String {
        val uri = Uri.parse(value.trim().trimEnd('/'))
        require(uri.scheme == "http" || uri.scheme == "https") { "Enter a complete http:// or https:// address." }
        require(!uri.host.isNullOrBlank() && uri.port == 8765) { "Use your Mac's address with port 8765." }
        require(uri.path.isNullOrBlank() && uri.query == null && uri.fragment == null) { "Enter the service address without a path." }
        return uri.toString()
    }

    fun reference(address: String, text: String): SentenceGuide {
        val url = URL("${validateAddress(address)}/api/reference?text=${Uri.encode(text)}")
        return SentenceGuide.fromJson(request(url, null, 30_000))
    }

    fun analyze(address: String, wav: ByteArray, intended: String? = null,
        phonemes: Boolean = false, gemma: Boolean = false, visual: JSONObject? = null): AnalysisResult {
        val query = buildString {
            append("exercise_id=free_speech&language=en&gemma=$gemma&phonemes=$phonemes&skip_phonemes=${!phonemes}")
            if (!intended.isNullOrBlank()) append("&intended_text=${Uri.encode(intended)}")
        }
        val url = URL("${validateAddress(address)}/api/analyze?$query")
        return AnalysisResult.fromJson(request(url, wav, if (gemma || phonemes) 480_000 else 180_000, visual))
    }

    private fun request(url: URL, wav: ByteArray?, timeout: Int, visual: JSONObject? = null): JSONObject {
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 12_000
            readTimeout = timeout
            if (wav != null) {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("Content-Type", "audio/wav")
                visual?.let { setRequestProperty("X-Speech-Mirror-Visual", it.toString()) }
                setFixedLengthStreamingMode(wav.size)
            }
        }
        try {
            if (wav != null) connection.outputStream.use { it.write(wav) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (status !in 200..299) {
                val detail = runCatching { JSONObject(body).optString("error") }.getOrNull()
                    ?.takeIf { it.isNotBlank() }
                throw IllegalStateException(detail ?: "Mac service returned HTTP $status. Check the sentence, recording, and connection.")
            }
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }
}
