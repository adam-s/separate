# Separate — Clean Mechanical Audio from Messy YouTube Data

An interactive data-viz post on pulling clean **engine/mechanical audio** out of messy
YouTube clips — filtering out speech and music, stage by stage, to build training data
for ML. Built with Svelte + Vite. The walkthrough runs from precomputed analysis, so it
works on any device; the audio model that produces that analysis runs **offline**, in
the data-prep pipeline.

Part of the adamsohn.com blog; ships to `blog/separate/`.

## 🚀 Project Overview

Car-diagnosis videos are a rich source of engine sounds — knocks, lifter ticks, wheel
bearings, exhaust — but they're buried under narration and background music. This post
shows how to separate the mechanical signal from the rest, and turn raw YouTube audio
into clean, labeled clips for training.

The reader can:

- Watch a mel-spectrogram and per-class filter traces update as a clip plays.
- See how each moment is tagged (speech / music / engine) and how per-class stems are
  extracted.
- Pick from several real clips and play the isolated engine result.

**Key concepts covered:**
- Audio classification with the AST (Audio Spectrogram Transformer) model
- Mel-spectrogram features and per-class filter traces (energy + spectral flatness)
- Span detection and per-class stem extraction

## 🖥️ Running the post locally

```bash
npm install
npm run dev
```

Then open the printed local URL.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run check` | `svelte-check` type/diagnostics pass |
| `npm run snapshot` | Tri-viewport screenshot loop for visual iteration |
| `npm run perf-profile` | Performance profiling |

## 🎛️ How it works

The app is entirely precomputed: every visualization reads from per-clip JSON, so nothing
heavy loads at runtime and the walkthrough works on any device.

**Data pipeline — `scripts/prepare_clips.py` (offline):**
This is where the real audio model runs. It labels each clip with the AST model, computes
features, builds spans + per-class stems, and writes:

- `public/audio/*.mp3` — the clips and per-class stems the app plays
- `public/data/<slug>.json` — per-clip analysis (shape defined in `src/lib/data.ts`)
- `public/data/clips.json` — the clip index

**Frontend — `src/`:**

- `App.svelte` / `lib/components/` — post scaffold, hero, clip picker, playback surface
- `lib/viz/` — the visualizations: `MelSpectrogram`, `FilterTraces`, `AstRibbon`,
  `StemExtraction`, `EngineResult`
- `lib/audio/transport.svelte.ts` — the shared playback clock
- `lib/data.ts` — the clip/analysis data shapes

---

*An educational, interactive explainer — a sandbox for understanding how a small audio
pipeline turns noisy real-world video into clean ML training data.*
