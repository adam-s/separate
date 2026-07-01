# Separate — Clean Mechanical Audio from Messy YouTube Data

An interactive, in-browser data-viz post on pulling clean **engine/mechanical audio**
out of messy YouTube clips — filtering out speech and music live, on your own GPU, to
build training data for ML. Built with Svelte + Vite, running an audio model with
[transformers.js](https://github.com/huggingface/transformers.js) on **WebGPU**.

Part of the adamsohn.com blog; ships to `blog/separate/`.

## 🚀 Project Overview

Car-diagnosis videos are a rich source of engine sounds — knocks, lifter ticks, wheel
bearings, exhaust — but they're buried under narration and background music. This post
shows how to separate the mechanical signal from the rest, in the browser, and turn raw
YouTube audio into clean, labeled clips for training.

The reader can:

- Watch a mel-spectrogram and per-class filter traces update as a clip plays.
- See the model tag each moment (speech / music / engine) and extract per-class stems.
- Run the live model on their own machine, or follow a precomputed walkthrough.

**Key concepts covered:**
- Audio classification with the AST (Audio Spectrogram Transformer) model
- Mel-spectrogram features and per-class filter traces
- Span detection and per-class stem extraction
- Running transformers.js models on WebGPU, with graceful capability fallbacks

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

The live path loads an audio model via transformers.js and runs it entirely
client-side on WebGPU — no audio leaves the browser. It's capability-gated (WebGPU +
non-mobile + ≥ 4 GB); where the live model isn't a good fit, the post serves a
**precomputed walkthrough** instead, so every reader gets the full experience.

**Data pipeline — `scripts/prepare_clips.py`:**
Builds the clips the app serves. It labels each clip with the real AST model, computes
features, builds spans + per-class stems, and writes:

- `public/audio/*.wav` — the audio stems
- `public/data/<slug>.json` — per-clip analysis (shape defined in `src/lib/data.ts`)
- `public/data/clips.json` — the clip index

**Frontend — `src/`:**
- `App.svelte` / `lib/components/` — post scaffold, hero, clip picker, model loader
- `lib/viz/` — the visualizations: `MelSpectrogram`, `FilterTraces`, `StemExtraction`,
  `AstRibbon`, `EngineResult`, and the playback surface
- `lib/audio/` — `recognizer.svelte.ts` (the model) and `transport.svelte.ts` (playback)
- `lib/data.ts` — the clip/analysis data shapes

## 📱 Mobile

The precomputed walkthrough is the universal path. The live model is capability-gated;
on devices that can't run it well, the download simply isn't offered.

---

*An educational, interactive explainer — a sandbox for understanding how browser-based
audio models can turn noisy real-world video into clean ML training data.*
