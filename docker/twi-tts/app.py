"""
On-prem Asante Twi text-to-speech — an OpenAI-compatible `/v1/audio/speech` wrapper around the
BibleTTS Asante Twi VITS model (Coqui `tts_models/tw_asante/openbible/vits`). Loads the model from
explicit on-disk paths (no network/downloader) — fully air-gappable. Returns 16-bit PCM WAV.

License: model + data are CC-BY-SA-4.0 (commercial use permitted; ShareAlike applies). Original
audio/text by Biblica (open.bible). This replaces the non-commercial Meta MMS mms-tts-aka engine.
"""

import io
import os
import wave

import numpy as np
from fastapi import FastAPI, Response
from pydantic import BaseModel
from TTS.utils.synthesizer import Synthesizer

MODEL_DIR = os.environ.get("TWI_MODEL_DIR", "/models/asante-twi")

synth = Synthesizer(
    tts_checkpoint=os.path.join(MODEL_DIR, "model_file.pth"),
    tts_config_path=os.path.join(MODEL_DIR, "config.json"),
    use_cuda=False,
)
SAMPLE_RATE = synth.output_sample_rate

app = FastAPI(title="vms-twi-tts (BibleTTS Asante)")


class SpeechRequest(BaseModel):
    input: str
    model: str = "tts-1"
    voice: str = "asante"
    response_format: str = "wav"
    speed: float = 1.0


def _wav_bytes(audio) -> bytes:
    pcm = (np.clip(np.asarray(audio, dtype=np.float32), -1.0, 1.0) * 32767.0).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())
    return buf.getvalue()


@app.get("/v1/models")
def models():
    return {"object": "list", "data": [{"id": "tts-1", "object": "model", "owned_by": "bibletts-asante"}]}


@app.get("/health")
def health():
    return {"ok": True, "model": "bibletts/tw_asante", "sampleRate": SAMPLE_RATE}


# BibleTTS Asante's trained pace (length_scale 1.0) is too fast for natural Twi, so slow the
# baseline. The OpenAI `speed` then adjusts relative to this (speed>1 faster, <1 slower).
TWI_BASE_LENGTH_SCALE = 1.3


@app.post("/v1/audio/speech")
def speech(req: SpeechRequest):
    # VITS `length_scale` sets tempo (higher = slower), so invert the OpenAI `speed` (>1 = faster).
    try:
        synth.tts_model.length_scale = max(0.25, min(4.0, TWI_BASE_LENGTH_SCALE / req.speed))
    except Exception:
        pass
    wav = synth.tts(req.input)
    return Response(content=_wav_bytes(wav), media_type="audio/wav")
