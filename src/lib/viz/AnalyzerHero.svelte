<script lang="ts">
  import type { ClipData, Label } from '../data';
  import { LABEL_COLORS } from '../data';
  import type { Transport } from '../audio/transport.svelte';

  let { data, transport }: { data: ClipData; transport: Transport } = $props();

  let wrap: HTMLDivElement;
  let specCanvas: HTMLCanvasElement;
  let overlayCanvas: HTMLCanvasElement;
  let fftCanvas: HTMLCanvasElement;
  let w = $state(880);

  // Geometry (px). The spectrogram is the centerpiece; an FFT strip sits below it.
  const TOP = 0;
  const SPEC_H = 200;
  const FFT_H = 56;

  // The hero shares the global transport state. When the shared audio plays, the scan
  // follows the shared playhead; when idle it runs a gentle local attract sweep.
  let t = $state(0); // scan position, seconds
  const live = $derived(transport.playing);

  const frames = $derived(data.frames);
  const mel = $derived(data.melSpectrogram);
  const dur = $derived(data.durationSec);

  const curFrame = $derived(frames[Math.min(frames.length - 1, Math.max(0, Math.floor(t / 0.05)))]);
  const ast = $derived(curFrame?.ast ?? { speech: 0, music: 0, target: 0 });
  const dominant = $derived(
    (Object.entries(ast).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'silence') as Label
  );

  // Class-tinted spectrogram: each column's energy is drawn in its source's color
  // (grey speech / gold music / green engine), lifted from a cream floor.
  const CREAM: [number, number, number] = [253, 252, 249];
  const RGB: Record<string, [number, number, number]> = {
    speech: [154, 154, 154],
    music: [200, 162, 62],
    target: [42, 122, 74],
  };
  function classRgbAt(time: number): [number, number, number] {
    const fr = frames[Math.min(frames.length - 1, Math.max(0, Math.floor(time / 0.05)))];
    const a = fr?.ast ?? { speech: 0, music: 0, target: 0 };
    const tot = a.speech + a.music + a.target || 1;
    return [
      (RGB.speech[0] * a.speech + RGB.music[0] * a.music + RGB.target[0] * a.target) / tot,
      (RGB.speech[1] * a.speech + RGB.music[1] * a.music + RGB.target[1] * a.target) / tot,
      (RGB.speech[2] * a.speech + RGB.music[2] * a.music + RGB.target[2] * a.target) / tot,
    ];
  }

  $effect(() => {
    if (!wrap) return;
    const ro = new ResizeObserver((e) => (w = Math.max(280, Math.floor(e[0].contentRect.width))));
    ro.observe(wrap);
    return () => ro.disconnect();
  });

  // Static spectrogram, drawn once per size.
  $effect(() => {
    if (!specCanvas) return;
    const cols = mel.frames.length;
    const rows = mel.nMels;
    const off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(cols, rows);
    for (let x = 0; x < cols; x++) {
      const [cr, cg, cb] = classRgbAt((x / cols) * dur);
      for (let y = 0; y < rows; y++) {
        const v = mel.frames[x][rows - 1 - y];
        const k = Math.pow(v, 0.6);
        const idx = (y * cols + x) * 4;
        img.data[idx] = CREAM[0] + (cr - CREAM[0]) * k;
        img.data[idx + 1] = CREAM[1] + (cg - CREAM[1]) * k;
        img.data[idx + 2] = CREAM[2] + (cb - CREAM[2]) * k;
        img.data[idx + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    specCanvas.width = w * dpr;
    specCanvas.height = SPEC_H * dpr;
    specCanvas.style.width = `${w}px`;
    specCanvas.style.height = `${SPEC_H}px`;
    const ctx = specCanvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, SPEC_H);
    // faint technical gridlines
    ctx.strokeStyle = 'rgba(26,26,26,0.06)';
    ctx.lineWidth = 1;
    for (let gx = 1; gx < 10; gx++) {
      ctx.beginPath();
      ctx.moveTo((gx / 10) * w, 0);
      ctx.lineTo((gx / 10) * w, SPEC_H);
      ctx.stroke();
    }
  });

  const NBINS = 64;
  const peaks = new Array(NBINS).fill(0); // decaying peak-hold for the spectrum bars
  const raw = new Array<number>(NBINS); // reusable per-frame spectrum scratch (no per-frame alloc)

  // Resize a canvas only when its size actually changed (assigning width/height reallocates
  // and clears the backing store), then clear + set the DPR transform for this frame.
  function fitCanvas(c: HTMLCanvasElement, cw: number, ch: number, dpr: number): CanvasRenderingContext2D {
    const pw = Math.round(cw * dpr);
    const ph = Math.round(ch * dpr);
    if (c.width !== pw || c.height !== ph) {
      c.width = pw;
      c.height = ph;
      c.style.width = `${cw}px`;
      c.style.height = `${ch}px`;
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    return ctx;
  }

  // Overlay (scan line + dim mask) + FFT strip, redrawn each frame (cheap).
  function drawDynamic() {
    if (!overlayCanvas || !fftCanvas) return;
    const dpr = window.devicePixelRatio || 1;

    const o = fitCanvas(overlayCanvas, w, SPEC_H, dpr);

    const scanX = (t / dur) * w;
    // dim scanned speech/music; tint scanned engine
    for (const s of data.spans) {
      const x0 = (s.startSec / dur) * w;
      const x1 = (Math.min(s.endSec, t) / dur) * w;
      if (x1 <= x0) continue;
      if (s.label === 'speech' || s.label === 'music') {
        o.fillStyle = 'rgba(253,252,249,0.82)';
        o.fillRect(x0, 0, x1 - x0, SPEC_H);
      } else if (s.label === 'target') {
        o.fillStyle = 'rgba(42,122,74,0.14)';
        o.fillRect(x0, 0, x1 - x0, SPEC_H);
      }
    }
    // scan line
    o.strokeStyle = '#1a1a1a';
    o.lineWidth = 1.5;
    o.beginPath();
    o.moveTo(scanX, 0);
    o.lineTo(scanX, SPEC_H);
    o.stroke();

    // FFT strip: current spectrum as bars, colored by dominant class
    const f = fitCanvas(fftCanvas, w, FFT_H, dpr);
    const N = NBINS;
    // Map the display onto a LOG frequency axis bounded to where the content actually is
    // (60 Hz - 7.8 kHz). The AnalyserNode runs at the AudioContext rate (e.g. 48 kHz) but
    // the source tops out at 8 kHz, so a linear map left the right ~40% on pure silence.
    // Compute each column's bin from the true Nyquist so the spectrum spans the panel.
    const fd = live ? transport.freq() : null;
    const isLive = !!fd;
    let src: ArrayLike<number>;
    let nyquist: number;
    if (isLive && fd) {
      src = fd;
      nyquist = transport.sampleRate / 2;
    } else {
      src = mel.frames[Math.min(mel.frames.length - 1, Math.floor((t / dur) * mel.frames.length))] ?? [];
      nyquist = data.sampleRate / 2;
    }
    const len = src.length || 1;
    // Log frequency axis over the content band (where energy lives), bins from the true
    // Nyquist so the right end isn't silence.
    const FMIN = 50;
    const FMAX = Math.min(6000, nyquist * 0.95);
    let vmax = 0;
    for (let i = 0; i < N; i++) {
      const fHz = FMIN * Math.pow(FMAX / FMIN, i / (N - 1));
      const bin = Math.min(len - 1, Math.max(0, Math.round((fHz / nyquist) * len)));
      const v = Math.pow(Math.max(0, isLive ? (src[bin] as number) / 255 : src[bin] ?? 0), 0.6);
      raw[i] = v;
      if (v > vmax) vmax = v;
    }
    // Per-FRAME normalize: keeps the spectral SHAPE (low bars tall, high bars short)
    // while filling the height. (Per-bin AGC flattened it into a featureless band.)
    const scale = 1 / Math.max(vmax, 0.12);
    const col = LABEL_COLORS[dominant] ?? '#9a9a9a';
    const bw = w / N;
    for (let i = 0; i < N; i++) {
      const v = Math.min(1, raw[i] * scale);
      peaks[i] = Math.max(v, peaks[i] - 0.02);
      const bh = Math.max(1, v * (FFT_H - 2));
      f.fillStyle = col;
      f.globalAlpha = 0.9;
      f.fillRect(i * bw + 0.5, FFT_H - bh, bw - 1.5, bh);
      // decaying peak-hold cap
      f.globalAlpha = 0.45;
      f.fillStyle = '#1a1a1a';
      f.fillRect(i * bw + 0.5, FFT_H - Math.max(2, peaks[i] * (FFT_H - 2)) - 1.5, bw - 1.5, 1.5);
    }
    f.globalAlpha = 1;
  }

  // No private clock: redraw whenever the shared transport advances a frame (while playing)
  // or the clip/size changes. The scan follows transport.t — 0 at rest, the seek position
  // when paused after scrubbing, the playhead while playing — so it stays in sync with the rest.
  $effect(() => {
    transport.frame; // dependency: one tick of the single clock
    void w;
    void dur; // redraw on clip change
    t = transport.t;
    drawDynamic();
  });

  type AstKey = 'speech' | 'music' | 'target';
  const meters: { label: AstKey; name: string }[] = [
    { label: 'speech', name: 'SPEECH' },
    { label: 'music', name: 'MUSIC' },
    { label: 'target', name: 'ENGINE' },
  ];
</script>

<div class="analyzer" bind:this={wrap}>
  <div class="readout">
    <span class="title">SPECTRAL ANALYSIS</span>
    <span class="status">{live ? 'running' : 'idle'} · isolating engine</span>
    <div class="meters">
      {#each meters as m}
        <div class="meter" class:on={dominant === m.label}>
          <span class="m-name" style:color={LABEL_COLORS[m.label]}>{m.name}</span>
          <span class="m-bar"><span class="m-fill" style:width={`${(ast[m.label] ?? 0) * 100}%`} style:background={LABEL_COLORS[m.label]}></span></span>
        </div>
      {/each}
    </div>
  </div>

  <div class="spec" style:height={`${SPEC_H}px`}>
    <canvas bind:this={specCanvas}></canvas>
    <canvas class="ov" bind:this={overlayCanvas}></canvas>
    <span class="ylab">f (kHz)</span>
  </div>

  <canvas class="fft" bind:this={fftCanvas} style:height={`${FFT_H}px`}></canvas>

  <div class="axis">
    <span>0:00</span>
    <span class="mid">instantaneous spectrum · t = {t.toFixed(1)}s</span>
    <span>{dur.toFixed(1)}s</span>
  </div>

  {#if data.audioUrl}
    <button class="run" onclick={() => transport.toggle()}>{live ? '❚❚ stop' : '▶ run analysis'}</button>
  {/if}
</div>

<style>
  .analyzer {
    width: 100%;
    margin: var(--space-lg) 0 var(--space-xl);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    background: var(--surface);
  }
  .readout {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
    margin-bottom: var(--space-sm);
  }
  .title {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.12em;
    color: var(--ink);
  }
  .status {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-subtle);
  }
  .meters {
    display: flex;
    gap: var(--space-md);
    margin-left: auto;
  }
  .meter {
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0.5;
    transition: opacity 0.15s ease;
  }
  .meter.on {
    opacity: 1;
  }
  .m-name {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.06em;
  }
  .m-bar {
    width: 44px;
    height: 5px;
    background: var(--surface-muted);
    border-radius: 3px;
    overflow: hidden;
  }
  .m-fill {
    display: block;
    height: 100%;
  }
  .spec {
    position: relative;
    width: 100%;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .spec canvas {
    width: 100%;
    display: block;
  }
  .spec .ov {
    position: absolute;
    inset: 0;
  }
  .ylab {
    position: absolute;
    left: 6px;
    top: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-subtle);
  }
  .fft {
    width: 100%;
    display: block;
    margin-top: 2px;
  }
  .axis {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-xs);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-subtle);
  }
  .mid {
    color: var(--ink-muted);
  }
  .run {
    margin-top: var(--space-sm);
    min-height: 36px;
    padding: 0 var(--space-md);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    cursor: pointer;
  }
  .run:hover {
    border-color: var(--accent);
  }
  .run:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
