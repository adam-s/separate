#!/usr/bin/env python3
"""Prepare real scraped clips for the in-browser picker, labeled with REAL AST.

For each clip: excerpt it, run the Audio Spectrogram Transformer in a sliding window to
get genuine speech / music / engine probabilities per frame (so music actually shows up,
not just speech), compute librosa features, build spans + per-class stems, and write
public/audio/<slug>.mp3 + public/data/<slug>.json + a clips.json index with link-backs.

Mixes YouTube (clear faults, narration) with TikTok (background music) so the post
visibly filters out BOTH speech and music. Run with the car-diagnosis venv:
  ~/Projects/car-diagnosis/.venv/bin/python scripts/prepare_clips.py
"""
import json
import subprocess
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from transformers import pipeline

SR = 16000
MAX = 16.0
HERE = Path(__file__).resolve().parent.parent
YT = Path.home() / "Projects/car-diagnosis/data/youtube/clips"
TT = Path.home() / "Projects/car-diagnosis/data/tiktok/clips"
AUDIO = HERE / "public/audio"
DATA = HERE / "public/data"
# CC BY 3.0 demo music: "Dance Monster" by Kevin MacLeod (incompetech.com)
MUSIC = HERE / "scripts/assets/dance-monster.mp3"


def write_mp3(stem: str, y: np.ndarray, sr: int) -> None:
    """Write mono PCM as a 64 kbps MP3 (keeps public/audio small; ~5x vs 16-bit WAV).

    Plays everywhere (incl. iOS Safari) and decodes fine for the in-browser recognizer.
    Requires ffmpeg on PATH.
    """
    tmp = AUDIO / f".{stem}.tmp.wav"
    sf.write(str(tmp), y, sr)
    try:
        subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(tmp),
             "-ac", "1", "-ar", str(sr), "-c:a", "libmp3lame", "-b:a", "64k",
             str(AUDIO / f"{stem}.mp3")],
            check=True,
        )
    finally:
        tmp.unlink(missing_ok=True)


# (slug, source, id, wav_rel, title, region)
CLIPS = [
    ("knock", "youtube", "Bad9JIBFoOI", "Bad9JIBFoOI/clip_03.wav", "Engine knock / rod knock", "engine"),
    ("exhaust", "youtube", "B9vCVByesGI", "B9vCVByesGI/clip_01.wav", "What an exhaust leak sounds like", "exhaust"),
    ("wheel-bearing", "youtube", "7yEeHzjAk2E", "7yEeHzjAk2E/clip_00.wav", "Wheel bearing noise", "suspension-steering"),
    # A constructed example: a real engine clip with a real music track interleaved in, so the
    # "filter out music" step has genuine, audible music to remove (scraped clips here were
    # already segmented to the car sound, and social links rot). Engine links back; the music
    # is "Dance Monster" by Kevin MacLeod (CC BY 3.0).
    ("music-mixed", "mix", "B9vCVByesGI", "B9vCVByesGI/clip_01.wav", "Engine with a music track mixed in", "exhaust"),
]

_music_cache = None


def music_track() -> np.ndarray:
    """The CC BY 3.0 demo music bed (normalized), loaded once and cached."""
    global _music_cache
    if _music_cache is None:
        m, _ = librosa.load(str(MUSIC), sr=SR, mono=True, offset=6.0)  # skip the intro
        _music_cache = (m / (np.max(np.abs(m)) or 1) * 0.95).astype(np.float32)
    return _music_cache

_clf = pipeline("audio-classification", model="MIT/ast-finetuned-audioset-10-10-0.4593")

SPEECH_KW = ("speech", "narrat", "conversation")
MUSIC_KW = ("music", "instrument", "singing", "guitar", "drum", "bass ", "hip hop", "electronic", "song", "synth")
ENGINE_KW = ("engine", "vehicle", "car", "motor", "idl", "acceler", "knock", "rev", "truck", "machine")


def bucket(res):
    s = m = e = 0.0
    for r in res:
        l = r["label"].lower()
        v = r["score"]
        if any(k in l for k in SPEECH_KW):
            s += v
        elif any(k in l for k in MUSIC_KW):
            m += v
        elif any(k in l for k in ENGINE_KW):
            e += v
    tot = s + m + e
    return (s / tot, m / tot, e / tot) if tot > 1e-6 else (0.0, 0.0, 0.0)


def ast_windows(y, dur, win=1.4, hop=0.5):
    """Slide AST across the clip -> list of (t_center, speech, music, engine)."""
    out = []
    t = 0.0
    while t < dur:
        a, b = int(t * SR), int((t + win) * SR)
        seg = y[a:b]
        if len(seg) < int(0.3 * SR):
            break
        s, m, e = bucket(_clf(seg, top_k=25))
        out.append((t + win / 2, s, m, e))
        t += hop
    return out or [(dur / 2, 0.0, 0.0, 1.0)]


def merge(frames, hop):
    spans, cur = [], None
    for f in frames:
        if cur and cur["label"] == f["label"]:
            cur["endSec"] = round(f["tSec"] + hop, 3)
        else:
            if cur and cur["label"] != "silence":
                spans.append(cur)
            cur = {"startSec": f["tSec"], "endSec": round(f["tSec"] + hop, 3), "label": f["label"]}
    if cur and cur["label"] != "silence":
        spans.append(cur)
    return [s for s in spans if s["endSec"] - s["startSec"] >= 0.2]


CID = {"speech": 1, "music": 2, "target": 3}


def process(slug, source, vid, wav_rel, title, region):
    if source == "mix":
        # interleave a real engine clip with a real music track: music, engine, music, ...
        # (music-dominant so the clip is clearly musical).
        eng, _ = librosa.load(str(YT / wav_rel), sr=SR, mono=True)
        eng = eng[: int(2.0 * SR)]
        eng = eng / (np.max(np.abs(eng)) or 1) * 0.9
        mus = music_track()
        parts = []
        mo = 0
        for _ in range(3):
            parts.append(mus[mo : mo + int(2.6 * SR)])  # a fresh music phrase each time
            mo += int(3.2 * SR)
            parts.append(eng[: int(2.0 * SR)])
        y = np.concatenate(parts).astype(np.float32)
    else:
        base = YT if source == "youtube" else TT
        p = base / wav_rel
        if p.suffix == ".wav":
            y, _ = librosa.load(str(p), sr=SR, mono=True)
        else:
            # a video folder: concatenate its segmented clips into one excerpt
            segs = []
            for w in sorted(p.glob("clip_*.wav")):
                yy, _ = librosa.load(str(w), sr=SR, mono=True)
                segs.append(yy)
            y = np.concatenate(segs) if segs else np.zeros(SR, dtype=np.float32)
    y = y[: int(MAX * SR)]
    if np.max(np.abs(y)) > 0:
        y = (y / np.max(np.abs(y)) * 0.95).astype(np.float32)
    dur = len(y) / SR
    write_mp3(slug, y, SR)

    wins = ast_windows(y, dur)
    wt = np.array([w[0] for w in wins])

    def scores_at(t):
        i = int(np.argmin(np.abs(wt - t)))
        return wins[i][1], wins[i][2], wins[i][3]

    hop = 256
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0]
    flat = librosa.feature.spectral_flatness(y=y, hop_length=hop)[0]
    rms_t = librosa.frames_to_time(np.arange(len(rms)), sr=SR, hop_length=hop)
    floor = max(0.01, float(np.percentile(rms, 20)))

    HOP_T = 0.05
    n = int(dur / HOP_T)
    frames = []
    for i in range(n):
        t = i * HOP_T
        j = int(np.argmin(np.abs(rms_t - t)))
        r = float(rms[min(j, len(rms) - 1)])
        s, m, e = scores_at(t)
        if r < floor:
            lab = "silence"
        else:
            lab = ["speech", "music", "target"][int(np.argmax([s, m, e]))]
        frames.append(
            {"tSec": round(t, 3), "rms": round(r, 4), "flatness": round(float(flat[min(j, len(flat) - 1)]), 4),
             "ast": {"speech": round(s, 3), "music": round(m, 3), "target": round(e, 3)},
             "vad": 0.9 if lab == "speech" else 0.1, "label": lab}
        )

    spans = [
        {"startSec": s["startSec"], "endSec": s["endSec"], "label": s["label"],
         "classId": CID[s["label"]], "kept": s["label"] == "target"}
        for s in merge(frames, HOP_T)
    ]

    n_peaks = 1400
    peaks = []
    step = len(y) / n_peaks
    for i in range(n_peaks):
        a, b = int(i * step), max(int(i * step) + 1, int((i + 1) * step))
        c = y[a:b]
        peaks.append([round(float(c.min()), 4), round(float(c.max()), 4)])

    n_mels = 64
    mel = librosa.feature.melspectrogram(y=y, sr=SR, n_mels=n_mels, hop_length=hop, fmax=SR // 2)
    mn = librosa.power_to_db(mel, ref=np.max)
    mn = (mn - mn.min()) / (mn.max() - mn.min() + 1e-9)
    cols = 220
    idx = np.linspace(0, mn.shape[1] - 1, cols).astype(int)
    frames_mel = [[round(float(v), 3) for v in mn[:, c]] for c in idx]

    gap = np.zeros(int(0.12 * SR), dtype=np.float32)
    stems = []
    for label in ("speech", "music", "target"):
        parts, chunk_map, cur = [], [], 0.0
        for sp in [s for s in spans if s["label"] == label]:
            a, b = int(sp["startSec"] * SR), int(sp["endSec"] * SR)
            seg = y[a:b]
            parts.append(seg)
            st = cur
            cur += len(seg) / SR
            chunk_map.append({"stemStart": round(st, 3), "stemEnd": round(cur, 3),
                              "origStart": sp["startSec"], "origEnd": sp["endSec"]})
            parts.append(gap)
            cur += len(gap) / SR
        if not parts:
            continue
        audio = np.concatenate(parts)
        write_mp3(f"{slug}-{label}", audio, SR)
        stems.append({"label": label, "classId": CID[label], "audioUrl": f"audio/{slug}-{label}.mp3",
                      "durationSec": round(len(audio) / SR, 3), "chunks": chunk_map})

    url = (f"https://www.youtube.com/watch?v={vid}" if source in ("youtube", "mix")
           else f"https://www.tiktok.com/video/{vid}")
    source_name = "YouTube" if source in ("youtube", "mix") else "TikTok"
    counts = {k: round(sum(s["endSec"] - s["startSec"] for s in spans if s["label"] == k) / dur * 100)
              for k in ("speech", "music", "target")}
    data = {
        "clip": slug, "durationSec": round(dur, 3), "sampleRate": SR, "audioUrl": f"audio/{slug}.mp3",
        "classes": [{"id": 1, "label": "speech"}, {"id": 2, "label": "music"}, {"id": 3, "label": "target"}],
        "waveformPeaks": peaks, "melSpectrogram": {"nMels": n_mels, "hop": hop, "frames": frames_mel},
        "frames": frames, "spans": spans, "stems": stems,
    }
    (DATA / f"{slug}.json").write_text(json.dumps(data))
    return {"slug": slug, "title": title, "source": source_name, "url": url,
            "durationSec": round(dur, 3), "mix": counts}


def main():
    AUDIO.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    index = []
    for c in CLIPS:
        try:
            info = process(*c)
            index.append(info)
            print(f"  ok {info['slug']}: {info['durationSec']}s  mix={info['mix']}")
        except Exception as e:
            print(f"  FAIL {c[0]}: {type(e).__name__} {e}")
    (DATA / "clips.json").write_text(json.dumps(index))
    print(f"Wrote {len(index)} clips -> clips.json")


if __name__ == "__main__":
    main()
