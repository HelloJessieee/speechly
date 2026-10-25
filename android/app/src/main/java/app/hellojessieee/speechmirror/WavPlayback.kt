package app.hellojessieee.speechmirror

import android.content.Context
import android.media.MediaPlayer
import java.io.File

class WavPlayback(private val context: Context, private val onFinished: () -> Unit) {
    private var player: MediaPlayer? = null
    private var file: File? = null

    fun play(wav: ByteArray) {
        stop()
        val copy = File.createTempFile("speech-mirror-attempt-", ".wav", context.cacheDir)
        copy.writeBytes(wav)
        file = copy
        val media = MediaPlayer()
        media.setDataSource(copy.absolutePath)
        media.setOnCompletionListener {
            stop()
            onFinished()
        }
        media.prepare()
        media.start()
        player = media
    }

    fun stop() {
        player?.let {
            runCatching { if (it.isPlaying) it.stop() }
            it.release()
        }
        player = null
        file?.delete()
        file = null
    }
}
