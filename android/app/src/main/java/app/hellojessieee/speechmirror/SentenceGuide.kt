package app.hellojessieee.speechmirror

import org.json.JSONObject

data class GuideWord(val text: String, val phones: List<String>)
data class GuideFrame(val atMs: Long, val shape: MouthShape, val wordIndex: Int?,
    val caption: String = "", val sound: String? = null)
data class SentenceGuide(val text: String, val words: List<GuideWord>, val frames: List<GuideFrame>) {
    val durationMs: Long get() = frames.lastOrNull()?.atMs ?: 0L

    fun wordAt(timeMs: Long): Int? = frames.lastOrNull { it.atMs <= timeMs }?.wordIndex

    fun poseAt(timeMs: Long): MouthPose {
        if (frames.isEmpty()) return MouthShape.REST.pose
        val next = frames.indexOfFirst { it.atMs > timeMs }
        if (next < 0) return frames.last().shape.pose
        if (next == 0) return frames.first().shape.pose
        val before = frames[next - 1]
        val after = frames[next]
        val raw = ((timeMs - before.atMs).toFloat() / (after.atMs - before.atMs).coerceAtLeast(1)).coerceIn(0f, 1f)
        val eased = raw * raw * (3 - 2 * raw)
        return before.shape.pose.blend(after.shape.pose, eased)
    }

    companion object {
        fun fromJson(json: JSONObject): SentenceGuide {
            val array = json.getJSONArray("words")
            val words = (0 until array.length()).map { index ->
                val item = array.getJSONObject(index)
                val phones = item.getJSONArray("phones")
                GuideWord(item.getString("text"), (0 until phones.length()).map(phones::getString))
            }
            val frames = mutableListOf(GuideFrame(0, MouthShape.REST, null, "Get ready"))
            var time = 180L
            words.forEachIndexed { index, word ->
                word.phones.forEach { phone ->
                    frames += GuideFrame(time, MouthShape.fromPhone(phone), index, word.text, "/$phone/")
                    time += if (phone.any { it in "aeiouɑæɪʊɔəɚɝɛ" }) 210 else 130
                }
                time += 80
            }
            frames += GuideFrame(time + 220, MouthShape.REST, null, "Sentence complete — replaying")
            return SentenceGuide(json.getString("text"), words, frames)
        }
    }
}

data class MouthPose(val opening: Float, val halfWidth: Float, val upper: Float, val lower: Float) {
    fun blend(other: MouthPose, fraction: Float): MouthPose {
        fun lerp(a: Float, b: Float) = a + (b - a) * fraction
        return MouthPose(lerp(opening, other.opening), lerp(halfWidth, other.halfWidth),
            lerp(upper, other.upper), lerp(lower, other.lower))
    }
}

enum class MouthShape(val pose: MouthPose) {
    REST(MouthPose(3f, 70f, 15f, 19f)),
    CLOSED(MouthPose(0f, 68f, 14f, 17f)),
    OPEN(MouthPose(34f, 62f, 13f, 17f)),
    SPREAD(MouthPose(13f, 86f, 11f, 14f)),
    ROUNDED(MouthPose(22f, 38f, 19f, 22f)),
    LIP_TEETH(MouthPose(6f, 72f, 14f, 14f)),
    TEETH_TOGETHER(MouthPose(11f, 82f, 11f, 14f));

    companion object {
        fun fromName(name: String): MouthShape = when (name) {
            "closed" -> CLOSED
            "open" -> OPEN
            "spread" -> SPREAD
            "rounded" -> ROUNDED
            "lipTeeth" -> LIP_TEETH
            "teethTogether" -> TEETH_TOGETHER
            else -> REST
        }

        fun fromPhone(phone: String): MouthShape {
            val p = phone.replace("ː", "")
            return when {
                listOf("p", "b", "m").any(p::startsWith) -> CLOSED
                listOf("f", "v").any(p::startsWith) -> LIP_TEETH
                listOf("u", "ʊ", "o", "ɔ", "w").any(p::startsWith) -> ROUNDED
                listOf("a", "ɑ", "æ", "ɒ", "ʌ").any(p::startsWith) -> OPEN
                listOf("i", "ɪ", "e", "ɛ", "ə").any(p::startsWith) -> SPREAD
                listOf("s", "z", "θ", "ð").any(p::startsWith) -> TEETH_TOGETHER
                listOf("ʃ", "ʒ", "tʃ", "dʒ", "ɹ").any(p::startsWith) -> ROUNDED
                else -> REST
            }
        }
    }
}
