<script lang="ts">
  import type { ClipInfo, ClipData } from '../data';
  import type { Transport } from '../audio/transport.svelte';

  // A persistent bottom bar: switch clips, play/scrub, and a small live audio viz that
  // follows the shared transport. Additive — the page works without it.
  let {
    clips,
    active,
    onpick,
    data,
    transport,
  }: {
    clips: ClipInfo[];
    active: string;
    onpick: (slug: string) => void;
    data: ClipData | null;
    transport: Transport | null;
  } = $props();

  let canvas: HTMLCanvasElement;
  const W = 160;
  const H = 36;

  const current = $derived(clips.find((c) => c.slug === active));

  function fmt(t: number): string {
    const s = Math.floor(t);
    return `0:${String(s).padStart(2, '0')}`;
  }

  function draw() {
    if (!canvas || !data || !transport) return;
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(W * dpr);
    const ph = Math.round(H * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; // only reallocates on DPR change, not every frame
      canvas.height = ph;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const mid = H / 2;
    const peaks = data.waveformPeaks;
    const px = (transport.t / data.durationSec) * W;
    // Waveform envelope; the part before the playhead is "played" (green), the rest muted.
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x++) {
      const [mn, mx] = peaks[Math.floor((x / W) * peaks.length)] ?? [0, 0];
      ctx.strokeStyle = x <= px ? '#2a7a4a' : '#c8c4bb';
      ctx.beginPath();
      ctx.moveTo(x + 0.5, mid + mn * (H / 2 - 1));
      ctx.lineTo(x + 0.5, mid + mx * (H / 2 - 1));
      ctx.stroke();
    }
    // playhead
    ctx.strokeStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();
  }

  $effect(() => {
    if (!canvas || !transport) return;
    transport.frame; // dependency: one tick of the single clock
    void data; // redraw on clip change
    draw();
  });
</script>

<footer class="bar">
  <select
    class="switch"
    value={active}
    onchange={(e) => onpick((e.target as HTMLSelectElement).value)}
    aria-label="Choose a recording"
  >
    {#each clips as c}
      <option value={c.slug}>{c.title}</option>
    {/each}
  </select>

  {#if transport}
    <button class="play" aria-label={transport.playing ? 'Pause' : 'Play'} onclick={() => transport.toggle()}>
      {transport.playing ? '❚❚' : '▶'}
    </button>
    <input
      class="scrub"
      type="range"
      min="0"
      max={transport.duration}
      step="0.01"
      value={transport.t}
      aria-label="Seek"
      oninput={(e) => transport.seek(+(e.target as HTMLInputElement).value)}
    />
    <span class="time">{fmt(transport.t)} / {fmt(transport.duration)}</span>
  {/if}

  <canvas bind:this={canvas} style:width={`${W}px`} style:height={`${H}px`} aria-hidden="true"></canvas>

  {#if current}
    <a class="credit" href={current.url} target="_blank" rel="noopener">
      source: {current.title} · {current.source} ↗
    </a>
  {/if}
</footer>

<style>
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-lg);
    background: rgba(253, 252, 249, 0.92);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--border-strong);
  }
  .switch {
    max-width: 220px;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink);
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    padding: 6px 8px;
    cursor: pointer;
  }
  .play {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--border-strong);
    background: var(--bg);
    color: var(--ink);
    font-size: var(--text-xs);
    cursor: pointer;
  }
  .play:hover {
    border-color: var(--accent);
  }
  .scrub {
    flex: 1;
    min-width: 60px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .time {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  canvas {
    flex: none;
    display: block;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  .credit {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    color: var(--ink-subtle);
    border-bottom: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
  }
  .credit:hover {
    color: var(--accent);
  }
  @media (max-width: 600px) {
    .time,
    canvas,
    .credit {
      display: none;
    }
    .switch {
      max-width: 140px;
    }
  }
</style>
