<script lang="ts">
  import type { ClipData, Label, Stem } from '../data';
  import { LABEL_COLORS, LABEL_TITLES } from '../data';
  import { claimAudio, releaseAudio, type Transport } from '../audio/transport.svelte';
  import Playhead from './Playhead.svelte';

  let { data, transport }: { data: ClipData; transport: Transport } = $props();

  const stems = $derived(data.stems ?? []);

  let wrap: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let width = $state(800);
  const HEIGHT = 150;

  // Which stem is auditioning, and where on the ORIGINAL its current chunk sits.
  let activeLabel = $state<Label | null>(null);
  let sourceFrac = $state(0);
  let showMarker = $state(false);

  const audios = new Map<Label, HTMLAudioElement>();
  let raf = 0;

  function labelAt(t: number): Label {
    for (const s of data.spans) if (t >= s.startSec && t < s.endSec) return s.label;
    return 'silence';
  }

  $effect(() => {
    if (!wrap) return;
    const ro = new ResizeObserver((e) => (width = Math.max(280, Math.floor(e[0].contentRect.width))));
    ro.observe(wrap);
    return () => ro.disconnect();
  });

  // Static draw; redraws only on size/data/active-class change (not per playback frame).
  $effect(() => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = width;
    const h = HEIGHT;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const peaks = data.waveformPeaks;
    const n = peaks.length;
    const mid = h / 2;
    for (let x = 0; x < w; x++) {
      const [min, max] = peaks[Math.floor((x / w) * n)] ?? [0, 0];
      const lab = labelAt((x / w) * data.durationSec);
      let alpha = lab === 'silence' ? 0.18 : 0.85;
      if (activeLabel) alpha = lab === activeLabel ? 1 : 0.12; // spotlight active class
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = LABEL_COLORS[lab];
      ctx.beginPath();
      ctx.moveTo(x + 0.5, mid + min * (h / 2));
      ctx.lineTo(x + 0.5, mid + max * (h / 2));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  function ensureAudio(stem: Stem): HTMLAudioElement {
    let a = audios.get(stem.label);
    if (!a) {
      a = new Audio(import.meta.env.BASE_URL + stem.audioUrl);
      a.addEventListener('ended', stop);
      audios.set(stem.label, a);
    }
    return a;
  }

  function tick() {
    const stem = stems.find((s) => s.label === activeLabel);
    const a = activeLabel ? audios.get(activeLabel) : null;
    if (!stem || !a) return;
    const t = a.currentTime;
    const chunk = stem.chunks.find((c) => t >= c.stemStart && t < c.stemEnd);
    if (chunk) {
      const within = t - chunk.stemStart;
      sourceFrac = (chunk.origStart + within) / data.durationSec;
      showMarker = true;
    } else {
      showMarker = false; // in a gap between chunks
    }
    raf = requestAnimationFrame(tick);
  }

  const stopBus = () => stop();

  function play(stem: Stem) {
    stop();
    claimAudio(stopBus); // stop the mixture transport / any other stem
    activeLabel = stem.label;
    const a = ensureAudio(stem);
    a.currentTime = 0;
    void a.play().catch(() => {});
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(raf);
    for (const a of audios.values()) {
      a.pause();
      a.currentTime = 0;
    }
    activeLabel = null;
    showMarker = false;
    releaseAudio(stopBus);
  }

  $effect(() => () => stop());

  // Clip changed: stop and drop cached stem audio (each was bound to the previous clip).
  $effect(() => {
    void data.clip;
    stop();
    audios.clear();
  });
</script>

<div class="extract" bind:this={wrap}>
  <div class="canvas-wrap" style:height={`${HEIGHT}px`}>
    <canvas bind:this={canvas} aria-label="Original mixture; the playing stem is mapped back onto it"></canvas>
    {#if activeLabel}
      <!-- auditioning a stem: the marker SKIPS across the original (the kept chunks only) -->
      {#if showMarker}
        <Playhead frac={sourceFrac} color={LABEL_COLORS[activeLabel]} />
      {/if}
    {:else}
      <!-- main clip playing: the shared linear playhead, synced with every other section -->
      <Playhead frac={(transport?.t ?? 0) / data.durationSec} color="rgba(26,26,26,0.55)" />
    {/if}
  </div>

  <div class="stems">
    {#each stems as stem}
      <button
        class="stem"
        class:active={activeLabel === stem.label}
        onclick={() => (activeLabel === stem.label ? stop() : play(stem))}
      >
        <span class="dot" style:background={LABEL_COLORS[stem.label]}>{stem.classId}</span>
        <span class="meta">
          <span class="name">{LABEL_TITLES[stem.label]}{stem.label === 'target' ? ' (keep)' : ''}</span>
          <span class="sub">{stem.chunks.length} chunks · {stem.durationSec.toFixed(1)}s</span>
        </span>
        <span class="icon">{activeLabel === stem.label ? '❚❚' : '▶'}</span>
      </button>
    {/each}
  </div>
  <p class="hint">
    Play a stream and watch the marker jump across the original to show where each
    chunk was pulled from.
  </p>
</div>

<style>
  .extract {
    width: 100%;
  }
  .canvas-wrap {
    position: relative;
    width: 100%;
  }
  canvas {
    width: 100%;
    display: block;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
  }
  .stems {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-sm);
    margin-top: var(--space-md);
  }
  .stem {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--bg);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .stem:hover {
    background: var(--surface);
  }
  .stem.active {
    border-color: var(--accent);
    background: var(--surface);
  }
  .stem:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .dot {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: #fff;
    font-family: var(--font-mono);
    font-weight: var(--weight-semibold);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink);
  }
  .sub {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-subtle);
  }
  .icon {
    margin-left: auto;
    color: var(--ink-muted);
    font-size: var(--text-sm);
  }
  .hint {
    margin-top: var(--space-sm);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  @media (max-width: 600px) {
    .stems {
      grid-template-columns: 1fr;
    }
  }
</style>
