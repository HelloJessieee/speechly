# Speechly Mac service

This Python package supplies the native iOS and Pixel apps with sentence mouth guides,
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

The Whisper model is required for automatic transcript suggestions. After the
user confirms a sentence, the app requests a short-phrase phoneme comparison
and a Gemma practice suggestion in separate stages. If a model is missing or
unavailable, measured results and a labelled rule-based practice step remain
visible. Gemma uses the GPU by default. The service warms Gemma and the phoneme
model in the background, so the first result request does not have to load them. Set
`SPEECH_MIRROR_GEMMA_BACKEND=cpu` only when GPU loading fails. The optional
fine-tuned phoneme checkpoint is published as an [adapter and model card on Hugging Face](https://huggingface.co/Jessicaaaaaaaaa/l2-arctic-perceived-phoneme-ctc).
Follow its restoration instructions and put the complete restored checkpoint in
`models/pronunciation/l2-arctic-ctc/best/`; the adapter alone cannot be loaded
by this service. Without the restored checkpoint, the base phoneme model is
used. This research candidate still needs a held-out test report.
Set `SPEECH_MIRROR_ASR_MODEL` or `SPEECH_MIRROR_GEMMA_MODEL` to an existing
local model path if the files are stored elsewhere.

On iPhone, open **Connection** from the gear icon and enter
`http://<your Mac LAN IP>:8765`, then tap **Test saved connection**. The Mac and
iPhone must share a trusted network. This local HTTP service has no
authentication or TLS; avoid exposing it to the public internet.

The `/api/reference` endpoint builds a word aligned mouth animation.
`/api/analyze` accepts PCM WAV audio and returns tentative model output and
measurements. Model suggestions are practice aids, not pronunciation scores.
