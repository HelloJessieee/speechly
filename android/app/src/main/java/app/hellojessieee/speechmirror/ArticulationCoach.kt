package app.hellojessieee.speechmirror

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp

private data class Cue(val phone: String, val viseme: String, val tip: String)

private fun cue(phone: String): Cue? {
    val clean = phone.replace("ˈ", "").replace("ˌ", "")
    val (shape, tip) = when (clean) {
        "m", "p", "b" -> "m" to "Bring both lips together, then release for /p/ or /b/."
        "f", "v" -> "fv" to "Bring your lower lip gently toward your upper teeth."
        "θ", "ð" -> "th" to "Let the tongue tip come forward gently between the teeth."
        "t", "d", "n", "l" -> "l" to "Lift the tongue tip behind the upper teeth."
        "s", "z" -> "sz" to "Keep the mouth narrow and the teeth near each other."
        "ʃ", "ʒ", "tʃ", "dʒ" -> "sh" to "Round the lips slightly for this sound."
        "i", "iː" -> "ee" to "Spread the lips gently with a small opening."
        "ɪ" -> "ih" to "Use a small opening with relaxed lips."
        "ɛ", "e", "æ" -> "eh" to "Open the jaw partway and keep the lips relaxed."
        "ɑ", "ɑː", "a", "aː", "ʌ" -> "aa" to "Open the jaw wider and relax the lips."
        "aɪ" -> "ay" to "Start open, then glide toward a smaller, wider mouth shape."
        "eɪ" -> "ey" to "Start half open, then glide toward a wider smile shape."
        "aʊ" -> "aw" to "Start open, then round the lips during the glide."
        "o", "oʊ", "ɔ", "ɔː" -> "oh" to "Round the lips with a medium jaw opening."
        "u", "uː", "ʊ" -> "oo" to "Round the lips more tightly with a small opening."
        else -> return null
    }
    return Cue(phone, shape, tip)
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun ArticulationCoach(result: AnalysisResult) {
    val cues = remember(result) {
        (result.phoneDifferences.mapNotNull { it.expected } + result.targetPhones)
            .mapNotNull(::cue).distinctBy { it.viseme }.take(5)
    }
    if (cues.isEmpty()) return
    var selected by remember(cues) { mutableStateOf(cues.first()) }
    var side by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("See the target mouth shape for /${selected.phone}/.")
        AndroidView(factory = { context ->
            WebView(context).apply {
                setBackgroundColor(AndroidColor.rgb(238, 243, 237))
                settings.javaScriptEnabled = true
                settings.allowFileAccess = true
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                        val path = request?.url?.path?.removePrefix("/") ?: return null
                        if (request.url.host != "speechly.local" || !path.startsWith("ArticulationStudio/")) return null
                        return try {
                            val mime = when {
                                path.endsWith(".html") -> "text/html"
                                path.endsWith(".js") -> "text/javascript"
                                else -> "text/plain"
                            }
                            WebResourceResponse(mime, "UTF-8", context.assets.open(path))
                        } catch (_: Exception) { null }
                    }
                }
                loadUrl("https://speechly.local/ArticulationStudio/index.html")
            }
        }, update = { view ->
            val direction = if (side) "side" else "front"
            view.evaluateJavascript("if(window.speechlyReady){speechlySetViseme('${selected.viseme}');speechlySetView('$direction')}else{window.addEventListener('speechly-ready',()=>{speechlySetViseme('${selected.viseme}');speechlySetView('$direction')},{once:true})}", null)
        }, modifier = Modifier.fillMaxWidth().height(230.dp))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            cues.forEach { item -> FilterChip(selected = item.viseme == selected.viseme,
                onClick = { selected = item }, label = { Text("/${item.phone}/") }) }
        }
        Text(selected.tip)
        OutlinedButton(onClick = { side = !side }) { Text(if (side) "Front" else "Side") }
        Text("Illustrative pose only. The camera cannot measure your tongue or teeth.")
    }
}
