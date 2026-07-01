<script lang="ts">
  import type { ClipData } from '../data';
  import type { Transport } from '../audio/transport.svelte';
  import Playhead from './Playhead.svelte';

  let { data, transport }: { data: ClipData; transport: Transport } = $props();

  let wrap: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let width = $state(800);
  const HEIGHT = 200;

  const frac = $derived(transport.t / data.durationSec);

  // Magma-ish ramp: low energy → background, high → warm. Kept dependency-free.
  function color(v: number): [number, number, number] {
    const stops: [number, [number, number, number]][] = [
      [0.0, [247, 245, 240]],
      [0.25, [122, 110, 150]],
      [0.55, [183, 75, 110]],
      [0.8, [232, 130, 60]],
      [1.0, [250, 220, 120]],
    ];
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (v >= stops[i][0] && v <= stops[i + 1][0]) {
        a = stops[i];
        b = stops[i + 1];
        break;
      }
    }
    const f = (v - a[0]) / (b[0] - a[0] || 1);
    return [
      Math.round(a[1][0] + (b[1][0] - a[1][0]) * f),
      Math.round(a[1][1] + (b[1][1] - a[1][1]) * f),
      Math.round(a[1][2] + (b[1][2] - a[1][2]) * f),
    ];
  }

  $effect(() => {
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      width = Math.max(280, Math.floor(entries[0].contentRect.width));
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  });

  // Redraw the spectrogram whenever the clip data or size changes (NOT per playback
  // frame — the moving playhead is a separate overlay). Reading data.melSpectrogram
  // and `width` here makes this effect re-run on every clip switch.
  $effect(() => {
    if (!canvas) return;
    const frames = data.melSpectrogram.frames;
    const cols = frames.length;
    const rows = data.melSpectrogram.nMels;

    // Build at native mel resolution in an offscreen buffer...
    const off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(cols, rows);
    for (let x = 0; x < cols; x++) {
      const col = frames[x];
      for (let y = 0; y < rows; y++) {
        const v = col[rows - 1 - y]; // low mel at bottom
        const [r, g, b] = color(v);
        const idx = (y * cols + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);

    // ...then scale it onto the visible canvas.
    const dpr = window.devicePixelRatio || 1;
    const w = width;
    const h = HEIGHT;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(off, 0, 0, w, h);
  });
</script>

<div class="spectrogram" bind:this={wrap} id="spectrogram">
  <div class="canvas-wrap" style:height={`${HEIGHT}px`}>
    <canvas bind:this={canvas} aria-label="Log-mel spectrogram of the clip"></canvas>
    <Playhead {frac} color="rgba(255,255,255,0.9)" />
  </div>
  <div class="axis">
    <span>0:00</span>
    <span class="ylabel">mel frequency →</span>
    <span>{data.durationSec.toFixed(1)}s</span>
  </div>
</div>

<style>
  .spectrogram {
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
  .axis {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-xs);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-subtle);
  }
  .ylabel {
    font-family: var(--font-sans);
  }
</style>
