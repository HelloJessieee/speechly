package app.hellojessieee.speechmirror

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class Lesson(
    val id: String, val text: String, val respelling: String, val ipa: String,
    val explanation: String, val tip: String, val note: String?,
    val timeline: List<GuideFrame>, val correction: List<GuideFrame>, val correctionInstruction: String,
    val demoSuggestion: String,
) {
    fun guide(correctionMode: Boolean = false): SentenceGuide {
        val frames = if (correctionMode) correction else timeline
        val words = text.split(Regex("\\s+")).map { GuideWord(it.trimEnd('.', '!', '?'), emptyList()) }
        val indexed = frames.map { frame ->
            val word = if (words.size <= 1) 0 else when (id) {
                "see-me" -> if (frame.atMs < 2450) 0 else if (frame.atMs < 4500) 1 else null
                else -> if (frame.atMs < frames.last().atMs) 0 else null
            }
            frame.copy(wordIndex = word)
        }
        return SentenceGuide(text, words, indexed)
    }

    companion object {
        fun load(context: Context): List<Lesson> {
            val json = JSONArray(context.assets.open("lessons.json").bufferedReader().use { it.readText() })
            return (0 until json.length()).map { index ->
                val item = json.getJSONObject(index)
                val pronunciation = item.getJSONObject("pronunciation")
                val correction = item.getJSONObject("correction")
                Lesson(
                    id = item.getString("id"), text = item.getString("text"),
                    respelling = pronunciation.getString("respelling"), ipa = pronunciation.getString("ipa"),
                    explanation = item.getString("explanation"), tip = item.getString("tip"),
                    note = item.optString("note").ifBlank { null },
                    timeline = frames(item.getJSONArray("timeline")),
                    correction = frames(correction.getJSONArray("timeline")),
                    correctionInstruction = correction.getString("instruction"),
                    demoSuggestion = item.getJSONObject("demoFeedback").getJSONObject("suggestion").getString("tip"),
                )
            }
        }

        private fun frames(array: JSONArray): List<GuideFrame> = (0 until array.length()).map { index ->
            val item: JSONObject = array.getJSONObject(index)
            GuideFrame(item.getLong("at"), MouthShape.fromName(item.getString("shape")), null,
                item.optString("caption"), item.optString("sound").ifBlank { null })
        }
    }
}
