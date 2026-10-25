package app.hellojessieee.speechmirror

import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView

val GuideYellow = Color(0xFFE5F55A)
val MeasuredBlue = Color(0xFF51ABFF)

@Composable
fun CameraMouthGuide(tracker: FaceTracker, lips: LipFrame?, pose: MouthPose, mode: OutlineMode,
    referenceScale: Float = 1f,
    active: Boolean = true,
    modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val previewView = remember { PreviewView(context) }
    DisposableEffect(previewView, active) {
        if (active) tracker.attach(previewView)
        onDispose { if (active) tracker.detach(previewView) }
    }
    Box(modifier) {
        AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
        MouthOutlines(lips, pose, mode, referenceScale, Modifier.fillMaxSize())
    }
}

@Composable
fun MouthOutlines(lips: LipFrame?, pose: MouthPose, mode: OutlineMode,
    referenceScale: Float = 1f, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val center = lips?.center?.let { Offset((1f - it.x) * size.width, it.y * size.height) }
            ?: Offset(size.width * 0.5f, size.height * 0.67f)
        val measuredWidth = lips?.width?.let { it * size.width } ?: size.width * 0.38f
        val stroke = Stroke(width = 3f * density, cap = StrokeCap.Round, join = StrokeJoin.Round)
        if (mode != OutlineMode.YELLOW && lips != null) {
            listOf(lips.outer, lips.inner).forEach { contour ->
                if (contour.size > 2) {
                    val path = Path()
                    contour.forEachIndexed { index, point ->
                        val x = (1f - point.x) * size.width
                        val y = point.y * size.height
                        if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                    path.close()
                    drawPath(path, MeasuredBlue, style = stroke)
                }
            }
        }
        if (mode != OutlineMode.BLUE) {
            val referenceWidth = measuredWidth * referenceScale.coerceIn(.65f, 1.35f) *
                (pose.halfWidth / 70f).coerceIn(.5f, 1.25f)
            val half = referenceWidth / 2f
            val opening = referenceWidth * (pose.opening / 125f).coerceAtLeast(.025f)
            val outerHeight = opening / 2f + measuredWidth * .12f
            fun ellipse(halfWidth: Float, height: Float): Path = Path().apply {
                moveTo(center.x - halfWidth, center.y)
                cubicTo(center.x - halfWidth * .52f, center.y - height,
                    center.x + halfWidth * .52f, center.y - height, center.x + halfWidth, center.y)
                cubicTo(center.x + halfWidth * .52f, center.y + height,
                    center.x - halfWidth * .52f, center.y + height, center.x - halfWidth, center.y)
                close()
            }
            drawPath(ellipse(half, outerHeight), GuideYellow, style = stroke)
            drawPath(ellipse(half * .86f, opening * .58f), GuideYellow, style = stroke)
        }
    }
}

@Composable
fun ReferenceMouth(pose: MouthPose, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val center = Offset(size.width / 2f, size.height * .55f)
        val scale = size.width / 260f
        val half = pose.halfWidth * scale
        val opening = pose.opening * scale
        val upper = pose.upper * scale
        val lower = pose.lower * scale
        val outside = Path().apply {
            moveTo(center.x - half, center.y)
            cubicTo(center.x - half * .55f, center.y - opening / 2 - upper * 1.35f,
                center.x + half * .55f, center.y - opening / 2 - upper * 1.35f, center.x + half, center.y)
            cubicTo(center.x + half * .55f, center.y + opening / 2 + lower * 1.35f,
                center.x - half * .55f, center.y + opening / 2 + lower * 1.35f, center.x - half, center.y)
            close()
        }
        val inside = Path().apply {
            moveTo(center.x - half * .88f, center.y)
            cubicTo(center.x - half * .45f, center.y - opening * .7f,
                center.x + half * .45f, center.y - opening * .7f, center.x + half * .88f, center.y)
            cubicTo(center.x + half * .45f, center.y + opening * .7f,
                center.x - half * .45f, center.y + opening * .7f, center.x - half * .88f, center.y)
            close()
        }
        drawPath(outside, Color(0xFFB95B66))
        drawPath(inside, Color(0xFF4A2630))
        drawPath(outside, Color(0xFF893D48), style = Stroke(2f * density))
    }
}
