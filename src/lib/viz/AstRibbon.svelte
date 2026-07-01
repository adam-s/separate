<script lang="ts">
  import type { ClipData, Frame } from '../data';
  import { LABEL_COLORS } from '../data';
  import type { Transport } from '../audio/transport.svelte';

  // `liveFrames`, when present, are the per-slice scores the reader just computed on their
  // own GPU; they replace the precomputed ones so the same ribbon runs live.
  let {
    data,
    transport,
    liveFrames,
  }: { data: ClipData; transport: Transport; liveFrames?: Frame[] } = $props();

  const W = 1000;
  const H = 120;
  const frames = $derived(liveFrames ?? data.frames);
  const bw = $derived(frames.length ? W / frames.length : W);
  const x = (t: number) => (data.durationSec ? (t / data.durationSec) * W : 0);
  const playX = $derived(x(transport.t));

  // Which class is winning at the playhead — drives the live readout. Index the same way as
  // AnalyzerHero/ToolDemo (floor(t/0.05)) so the readouts agree at the same instant.
  const current = $derived.by(() => {
    const f = frames[Math.min(frames.length - 1, Math.max(0, Math.floor(transport.t / 0.05)))];
    if (!f) return null;
    const entries = Object.entries(f.ast) as [keyof typeof f.ast, number][];
    return entries.sort((a, b) => b[1] - a[1])[0];
  });
</script>

<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Per-frame class probabilities (speech, music, engine)">
  {#each frames as f, i}
    {@const sp = f.ast.speech}
    {@const mu = f.ast.music}
    {@const en = f.ast.target}
    {@const total = sp + mu + en || 1}
    {@const hSp = (sp / total) * H}
    {@const hMu = (mu / total) * H}
    {@const hEn = (en / total) * H}
    <rect x={i * bw} y={0} width={bw + 0.5} height={hSp} fill={LABEL_COLORS.speech} opacity="0.85" />
    <rect x={i * bw} y={hSp} width={bw + 0.5} height={hMu} fill={LABEL_COLORS.music} opacity="0.85" />
    <rect x={i * bw} y={hSp + hMu} width={bw + 0.5} height={hEn} fill={LABEL_COLORS.target} opacity="0.85" />
  {/each}
  <line x1={playX} x2={playX} y1={0} y2={H} stroke="var(--ink)" stroke-width="2" />
</svg>

<div class="readout">
  {#if current && current[1] >= 0.2}
    <span class="now" style:color={LABEL_COLORS[current[0]]}>{current[0]}</span>
    <span class="prob">{(current[1] * 100).toFixed(0)}%</span>
    <span class="hint">winning class at the playhead</span>
  {:else}
    <span class="now" style:color={LABEL_COLORS.silence}>quiet</span>
    <span class="hint">no class is confident here</span>
  {/if}
</div>

<style>
  svg {
    width: 100%;
    height: 120px;
    display: block;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
  }
  .readout {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
  }
  .now {
    font-weight: var(--weight-semibold);
    text-transform: capitalize;
  }
  .prob {
    font-family: var(--font-mono);
    color: var(--ink);
  }
  .hint {
    color: var(--ink-subtle);
  }
</style>
