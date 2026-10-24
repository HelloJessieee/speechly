# Speech Mirror Mac service

This Python package supplies the native iPhone app with sentence mouth guides,
English Whisper transcription, audio measurements, experimental phoneme
comparison, and optional local Gemma suggestions. The model files are downloaded
separately and are excluded from Git.

## Set up on a Mac

From the repository root, with Python 3.11 or newer and `espeak-ng` available:

```bash
cd mac_service
python3.11 -m venv .venv
.venv/bin/python -m pip install -e '.[asr,phonemes,gemma]'
.venv/bin/hf download openai/whisper-tiny.en --local-dir models/asr/whisper-tiny.en --include '*.safetensors' '*.json' '*.txt' '*.model'
.venv/bin/hf download facebook/wav2vec2-lv-60-espeak-cv-ft --local-dir models/phoneme
.venv/bin/hf download litert-community/gemma-4-E2B-it-litert-lm gemma-4-E2B-it.litertlm --local-dir models/gemma
.venv/bin/python -m speech_mirror.web --host 0.0.0.0 --port 8765
```

The Whisper model is required for automatic transcript suggestions. The
phoneme and Gemma downloads are needed only for their optional buttons on the
Results page. Set `SPEECH_MIRROR_ASR_MODEL` or `SPEECH_MIRROR_GEMMA_MODEL` to
an existing local model path if the files are stored elsewhere.

On iPhone, open **Connection** from the gear icon and enter
`http://<your Mac LAN IP>:8765`, then tap **Test saved connection**. The Mac and
iPhone must share a trusted network. This local HTTP service has no
authentication or TLS; avoid exposing it to the public internet.

The `/api/reference` endpoint builds a word aligned mouth animation.
`/api/analyze` accepts PCM WAV audio and returns tentative model output and
measurements. Model suggestions are practice aids, not pronunciation scores.
