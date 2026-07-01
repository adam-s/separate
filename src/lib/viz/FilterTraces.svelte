<script lang="ts">
  import type { ClipData } from '../data';
  import { LABEL_COLORS } from '../data';
  import type { Transport } from '../audio/transport.svelte';

  let { data, transport }: { data: ClipData; transport: Transport } = $props();

  // Responsive via viewBox; no canvas sizing needed.
  const W = 1000;
  const H = 220;
  // Small symmetric padding so the time axis spans ~full width, matching the other
  // replay visualizations (shared time axis: a given instant lands at the same x).
  const PAD = { l: 8, r: 8, t: 16, b: 24 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const FLAT_CEIL = 0.4; // flatness already 0..1

  // Pure scale helpers (take their inputs as args — no captured reactive state).
  const xAt = (t: number, dur: number) => PAD.l + (t / dur) * iw;
  const yRms = (v: number, max: number) => PAD.t + ih * (1 - v / max);
  const yFlat = (v: number) => PAD.t + ih * (1 - v);

  const frames = $derived(data.frames);
  const maxRms = $derived(Math.max(...frames.map((f) => f.rms), 0.01));
  const rmsFloor = $derived(maxRms * 0.15); // threshold mirroring the cascade

  const rmsPath = $derived(
    frames
      .map(
        (f, i) =>
          `${i === 0 ? 'M' : 'L'}${xAt(f.tSec, data.durationSec).toFixed(1)},${yRms(f.rms, maxRms).toFixed(1)}`
      )
      .join(' ')
  );
  const flatPath = $derived(
    frames
      .map(
        (f, i) =>
          `${i === 0 ? 'M' : 'L'}${xAt(f.tSec, data.durationSec).toFixed(1)},${yFlat(f.flatness).toFixed(1)}`
      )
      .join(' ')
  );

  const rmsFloorY = $derived(yRms(rmsFloor, maxRms));
  const flatCeilY = yFlat(FLAT_CEIL);
  const playX = $derived(xAt(transport.t, data.durationSec));
</script>

<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="RMS energy and spectral flatness over time">
  <!-- region bands -->
  {#each data.spans as s}
    <rect
      x={xAt(s.startSec, data.durationSec)}
      y={PAD.t}
      width={xAt(s.endSec, data.durationSec) - xAt(s.startSec, data.durationSec)}
      height={ih}
      fill={LABEL_COLORS[s.label]}
      opacity="0.06"
    />
  {/each}

  <!-- thresholds -->
  <line x1={PAD.l} x2={W - PAD.r} y1={rmsFloorY} y2={rmsFloorY} class="thresh" />
  <text x={PAD.l + 4} y={rmsFloorY - 4} class="tlabel">RMS floor</text>
  <line x1={PAD.l} x2={W - PAD.r} y1={flatCeilY} y2={flatCeilY} class="thresh dashed" />
  <text x={W - PAD.r - 4} y={flatCeilY - 4} class="tlabel end">flatness ceiling</text>

  <!-- traces -->
  <path d={rmsPath} class="rms" />
  <path d={flatPath} class="flat" />

  <!-- playhead -->
  <line x1={playX} x2={playX} y1={PAD.t} y2={H - PAD.b} class="playhead" />

  <!-- axis -->
  <text x={PAD.l} y={H - 6} class="axis">0:00</text>
  <text x={W - PAD.r} y={H - 6} class="axis end">{data.durationSec.toFixed(1)}s</text>
</svg>

<div class="legend">
  <span class="chip"><span class="line rms"></span> RMS energy (loudness)</span>
  <span class="chip"><span class="line flat"></span> spectral flatness (noise-like)</span>
</div>

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .rms {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
  }
  .flat {
    fill: none;
    stroke: #b0423e;
    stroke-width: 2;
  }
  .thresh {
    stroke: var(--ink-subtle);
    stroke-width: 1;
  }
  .thresh.dashed {
    stroke-dasharray: 4 3;
  }
  .playhead {
    stroke: var(--ink);
    stroke-width: 1;
  }
  .tlabel {
    font-family: var(--font-mono);
    font-size: 11px;
    fill: var(--ink-subtle);
  }
  .axis {
    font-family: var(--font-mono);
    font-size: 11px;
    fill: var(--ink-subtle);
  }
  .end {
    text-anchor: end;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-md);
    margin-top: var(--space-sm);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .line {
    width: 18px;
    height: 2px;
    display: inline-block;
  }
  .line.rms {
    background: var(--accent);
  }
  .line.flat {
    background: #b0423e;
  }
</style>
