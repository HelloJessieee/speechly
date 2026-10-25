package app.hellojessieee.speechmirror

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private val model by lazy { SpeechMirrorModel(applicationContext) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SpeechMirrorApp(this, model) }
    }

    override fun onDestroy() {
        model.close()
        super.onDestroy()
    }
}

@Composable
private fun SpeechMirrorApp(activity: MainActivity, model: SpeechMirrorModel) {
    var cameraAllowed by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    var audioAllowed by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
    }
    val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        cameraAllowed = it[Manifest.permission.CAMERA] ?: cameraAllowed
        audioAllowed = it[Manifest.permission.RECORD_AUDIO] ?: audioAllowed
    }
    LaunchedEffect(Unit) {
        if (!cameraAllowed || !audioAllowed) {
            permissions.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
        }
    }
    LaunchedEffect(cameraAllowed, model.cameraEnabled) {
        if (cameraAllowed && model.cameraEnabled) model.tracker.start(activity, model::reportCameraError)
        else model.tracker.stop()
    }
    SpeechMirrorScreen(
        model = model,
        cameraAllowed = cameraAllowed,
        audioAllowed = audioAllowed,
        requestPermissions = { permissions.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)) },
    )
}
