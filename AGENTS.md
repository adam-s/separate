# separate — agent guide

Svelte data-viz post: separating engine sound from speech and music in the browser
(transformers.js + WebGPU). Part of the adamsohn.com blog; ships to `blog/separate/`.

## Visual iteration

This is a portfolio piece. After any UI change, run the snapshot loop and read the
screenshots before claiming done. Workflow and tool reference:
`car-diagnosis/blog/temp_docs/iteration-and-snapshots.md`.

- `npm run dev` then `npm run snapshot -- --label=iter-NN-topic [--action=...]`.
- Read desktop + tablet + mobile screenshots in `.snapshots/<label>/`.
- A section is not done until tri-viewport snapshots pass the responsive checklist
  (no horizontal overflow, zero console/page/network errors, tap targets >= 44px,
  no hover-only UI, `prefers-reduced-motion` honored) and you've compared against
  the previous iteration.

## Writing style

Follow the anti-slop rules: be concrete, ration em-dashes, no filler. See
`car-diagnosis/.agent/rules/anti-slop.md`.

## Data

`scripts/prepare_clips.py` builds the clips the app serves: it labels each clip with the
real AST model, computes features, builds spans + per-class stems, and writes
`public/audio/*.wav` + `public/data/<slug>.json` + the `public/data/clips.json` index
(shape defined in `src/lib/data.ts`). Run it with the car-diagnosis venv.

## Mobile

Precomputed walkthrough is the universal path. The live model is capability-gated
(WebGPU + non-mobile + >=4 GB); where it's a problem, don't offer the download.
