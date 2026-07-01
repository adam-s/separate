# separate — agent guide

Svelte data-viz post: a walkthrough of separating engine sound from speech and music.
The app is entirely precomputed (works on any device); the audio model that produces the
data runs offline in `scripts/prepare_clips.py`. Part of the adamsohn.com blog; ships to
`blog/separate/`.

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
real AST model (offline), computes features, builds spans + per-class stems, and writes
`public/audio/*.mp3` + `public/data/<slug>.json` + the `public/data/clips.json` index
(shape defined in `src/lib/data.ts`). Run it with the car-diagnosis venv.

## Precomputed only

The app ships no model and runs no inference in the browser — every visualization reads
from the precomputed JSON, so it works on any device. If a change needs new numbers,
regenerate the data with `prepare_clips.py`; don't add runtime model loading.
