# On-prem Asante Twi TTS — Coqui TTS serving the BibleTTS VITS model
# (tts_models/tw_asante/openbible/vits, CC-BY-SA-4.0, commercial-use OK). The model (~922MB) is
# fetched on first start into the mounted /models volume (XDG_DATA_HOME) — pre-stage for air-gap.
# Pinned to TTS 0.22.0, the last Coqui release whose registry ships this model.
FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 \
    XDG_DATA_HOME=/models \
    COQUI_TOS_AGREED=1 \
    NUMBA_CACHE_DIR=/tmp \
    OMP_NUM_THREADS=4

# build-essential: TTS 0.22.0 has no py3.11/aarch64 wheel, so pip compiles its Cython extension.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential espeak-ng libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# CPU-only torch (the default Linux torch pulls multi-GB NVIDIA CUDA wheels even on arm64 — no GPU).
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir "TTS==0.22.0" "fastapi>=0.110" "uvicorn[standard]>=0.29"

WORKDIR /app
COPY app.py /app/app.py
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
