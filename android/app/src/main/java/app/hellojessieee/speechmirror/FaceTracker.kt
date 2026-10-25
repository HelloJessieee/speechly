package app.hellojessieee.speechmirror

import android.content.Context
import android.graphics.PointF
import android.os.Handler
import android.os.Looper
import androidx.camera.core.AspectRatio
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceContour
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.concurrent.Executors

data class LipPoint(val x: Float, val y: Float)
data class LipFrame(val outer: List<LipPoint>, val inner: List<LipPoint>,
    val center: LipPoint, val width: Float, val aperture: Float)

class FaceTracker(private val context: Context, private val onFrame: (LipFrame?) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private val detector = FaceDetection.getClient(FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setContourMode(FaceDetectorOptions.CONTOUR_MODE_ALL)
        .build())
    private var provider: ProcessCameraProvider? = null
    private var preview: Preview? = null
    private var previewView: PreviewView? = null

    fun start(owner: LifecycleOwner, onError: (String) -> Unit) {
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({
            try {
                val cameraProvider = future.get()
                val previewUseCase = Preview.Builder().setTargetAspectRatio(AspectRatio.RATIO_4_3).build()
                previewView?.let { previewUseCase.setSurfaceProvider(it.surfaceProvider) }
                val analysis = ImageAnalysis.Builder()
                    .setTargetAspectRatio(AspectRatio.RATIO_4_3)
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                analysis.setAnalyzer(executor) { image ->
                    val media = image.image
                    if (media == null) {
                        image.close()
                        return@setAnalyzer
                    }
                    val rotation = image.imageInfo.rotationDegrees
                    val width = if (rotation == 90 || rotation == 270) image.height else image.width
                    val height = if (rotation == 90 || rotation == 270) image.width else image.height
                    detector.process(InputImage.fromMediaImage(media, rotation))
                        .addOnSuccessListener { faces ->
                            val face = faces.firstOrNull()
                            val outerTop = face?.getContour(FaceContour.UPPER_LIP_TOP)?.points.orEmpty()
                            val outerBottom = face?.getContour(FaceContour.LOWER_LIP_BOTTOM)?.points.orEmpty()
                            val innerTop = face?.getContour(FaceContour.UPPER_LIP_BOTTOM)?.points.orEmpty()
                            val innerBottom = face?.getContour(FaceContour.LOWER_LIP_TOP)?.points.orEmpty()
                            fun normalize(points: List<PointF>) = points.map { LipPoint(it.x / width, it.y / height) }
                            val outer = normalize(outerTop + outerBottom.asReversed())
                            val inner = normalize(innerTop + innerBottom.asReversed())
                            val frame = if (outer.size >= 8) {
                                val left = outer.minOf { it.x }
                                val right = outer.maxOf { it.x }
                                val top = inner.minOfOrNull { it.y } ?: outer.minOf { it.y }
                                val bottom = inner.maxOfOrNull { it.y } ?: outer.maxOf { it.y }
                                LipFrame(outer, inner, LipPoint((left + right) / 2,
                                    (outer.minOf { it.y } + outer.maxOf { it.y }) / 2),
                                    right - left, (bottom - top).coerceAtLeast(0f))
                            } else null
                            onFrame(frame)
                        }
                        .addOnFailureListener { onFrame(null) }
                        .addOnCompleteListener { image.close() }
                }
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(owner, CameraSelector.DEFAULT_FRONT_CAMERA, previewUseCase, analysis)
                provider = cameraProvider
                preview = previewUseCase
            } catch (error: Exception) {
                onError(error.message ?: "Could not start the front camera.")
            }
        }, ContextCompat.getMainExecutor(context))
    }

    fun attach(view: PreviewView) {
        previewView = view
        view.scaleType = PreviewView.ScaleType.FIT_CENTER
        view.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        preview?.setSurfaceProvider(view.surfaceProvider)
    }

    fun detach(view: PreviewView) {
        if (previewView === view) {
            preview?.setSurfaceProvider(null)
            previewView = null
        }
    }

    fun stop() {
        provider?.unbindAll()
        preview = null
        onFrame(null)
    }

    fun close() {
        provider?.unbindAll()
        detector.close()
        executor.shutdown()
        main.removeCallbacksAndMessages(null)
    }
}
