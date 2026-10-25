package app.hellojessieee.speechmirror

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.concurrent.thread
import kotlin.math.sqrt

/** Records microphone PCM and returns a 16 kHz mono WAV accepted by the Mac service. */
class WavRecorder(private val onLevel: (Float) -> Unit = {}) {
    private val main = Handler(Looper.getMainLooper())
    private var recorder: AudioRecord? = null
    private var worker: Thread? = null
    private var samples = ByteArrayOutputStream()
    @Volatile private var running = false

    @Suppress("MissingPermission") // MainActivity requests RECORD_AUDIO before this method is called.
    fun start() {
        check(!running) { "A recording is already running." }
        val minSize = AudioRecord.getMinBufferSize(16_000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        check(minSize > 0) { "The microphone does not support 16 kHz PCM." }
        val device = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16_000,
            AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minSize * 2, 4096))
        if (device.state != AudioRecord.STATE_INITIALIZED) {
            device.release()
            error("Could not initialize the microphone.")
        }
        samples = ByteArrayOutputStream()
        recorder = device
        device.startRecording()
        running = true
        worker = thread(name = "speech-mirror-recorder") {
            val buffer = ByteArray(4096)
            while (running) {
                val count = device.read(buffer, 0, buffer.size)
                if (count > 0) {
                    samples.write(buffer, 0, count)
                    var energy = 0.0
                    var index = 0
                    while (index + 1 < count) {
                        val sample = ((buffer[index + 1].toInt() shl 8) or
                            (buffer[index].toInt() and 0xff)).toShort().toDouble() / 32768.0
                        energy += sample * sample
                        index += 2
                    }
                    val rms = sqrt(energy / (count / 2).coerceAtLeast(1))
                    main.post { onLevel((rms * 8).toFloat().coerceIn(0f, 1f)) }
                }
                if (count < 0) break
            }
        }
    }

    fun stop(): ByteArray {
        val device = recorder ?: error("No recording is active.")
        running = false
        try { device.stop() } catch (_: IllegalStateException) { }
        worker?.join(2_000)
        device.release()
        recorder = null
        worker = null
        val pcm = samples.toByteArray()
        check(pcm.size >= 3_840) { "The recording was too short. Try again." }
        return wav(pcm)
    }

    fun discard() {
        if (recorder != null) runCatching { stop() }
        samples = ByteArrayOutputStream()
        main.post { onLevel(0f) }
    }

    private fun wav(pcm: ByteArray): ByteArray {
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray(Charsets.US_ASCII))
        header.putInt(pcm.size + 36)
        header.put("WAVEfmt ".toByteArray(Charsets.US_ASCII))
        header.putInt(16)
        header.putShort(1)
        header.putShort(1)
        header.putInt(16_000)
        header.putInt(32_000)
        header.putShort(2)
        header.putShort(16)
        header.put("data".toByteArray(Charsets.US_ASCII))
        header.putInt(pcm.size)
        return header.array() + pcm
    }
}
