<script lang="ts">
  import type { ClipData } from '../data';
  import { LABEL_COLORS } from '../data';
  import type { Transport } from '../audio/transport.svelte';

  // A small illustration of what one tool does, drawn from the real clip data. No auto-run:
  // static when paused, and when the reader presses play it animates IN SYNC with the one
  // shared transport clock (same playhead time as the hero and section viz).
  let {
    kind,
    data,
    caption,
    transport,
  }: {
    kind: 'spectrogram' | 'filters' | 'ast' | 'vad';
    data: ClipData;
    caption?: string;
    transport?: Transport | null;
  } = $props();

  let wrap: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let w = $state(560);
  const H = 96;

  $effect(() => {
    if (!wrap) return;
    const ro = new ResizeObserver((e) => (w = Math.max(240, Math.floor(e[0].contentRect.width))));
    ro.observe(wrap);
    return () => ro.disconnect();
  });

  // Prebuilt greyscale spectrogram buffer (for the spectrogram demo).
  let specBuf: HTMLCanvasElement | null = null;
  $effect(() => {
    if (kind !== 'spectrogram') return;
    const f = data.melSpectrogram.frames;
    const cols = f.length;
    const rows = data.melSpectrogram.nMels;
    const off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const o = off.getContext('2d')!;
    const img = o.createImageData(cols, rows);
    for (let x = 0; x < cols; x++)
      for (let y = 0; y < rows; y++) {
        const v = f[x][rows - 1 - y];
        const g = Math.round(253 - v * 210);
        const i = (y * cols + x) * 4;
        img.data[i] = g;
        img.data[i + 1] = g - 4;
        img.data[i + 2] = g - 10;
        img.data[i + 3] = 255;
      }
    o.putImageData(img, 0, 0);
    specBuf = off;
  });

  // Draw once per size/data/frame. When playing, `p` is the shared playhead fraction (so the
  // reveal / marker / live readout track the same clock as everything else); when paused it's
  // null and the demo shows its full static state.
  function render() {
    if (!canvas) return;
    const playing = !!transport?.playing;
    const p = playing ? Math.max(0, Math.min(1, transport!.t / data.durationSec)) : null;
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(w * dpr);
    const ph = Math.round(H * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; // only reallocates on size/DPR change, not every frame
      canvas.height = ph;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${H}px`;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);

    if (kind === 'spectrogram') {
      // waveform on top; the spectrogram reveals up to the playhead while playing (full when paused)
      const reveal = p == null ? w : p * w;
      if (specBuf) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 24, reveal, H - 24);
        ctx.clip();
        ctx.drawImage(specBuf, 0, 24, w, H - 24);
        ctx.restore();
      }
      const peaks = data.waveformPeaks;
      ctx.strokeStyle = '#9a9a9a';
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const pk = peaks[Math.floor((x / w) * peaks.length)] ?? [0, 0];
        ctx.moveTo(x, 12 + pk[0] * 11);
        ctx.lineTo(x, 12 + pk[1] * 11);
      }
      ctx.stroke();
      if (p != null) drawPlayhead(ctx, reveal);
    } else if (kind === 'filters') {
      const fr = data.frames;
      const maxRms = Math.max(...fr.map((f) => f.rms), 0.01);
      const xx = (i: number) => (i / (fr.length - 1)) * w;
      ctx.fillStyle = 'rgba(176,66,62,0.10)';
      for (let i = 0; i < fr.length; i++) if (fr[i].flatness > 0.45) ctx.fillRect(xx(i), 0, w / fr.length + 1, H);
      const line = (get: (i: number) => number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        fr.forEach((_, i) => (i ? ctx.lineTo(xx(i), get(i)) : ctx.moveTo(0, get(0))));
        ctx.stroke();
      };
      line((i) => H - (fr[i].rms / maxRms) * (H - 8) - 4, 'var(--accent)');
      line((i) => H - fr[i].flatness * (H - 8) - 4, '#b0423e');
      if (p != null) drawPlayhead(ctx, p * w);
    } else if (kind === 'ast') {
      // While playing: the live frame at the playhead. Paused: the clip's average mix.
      const fr = data.frames;
      let vals: { speech: number; music: number; target: number };
      if (p != null) {
        vals = fr[Math.min(fr.length - 1, Math.max(0, Math.floor((transport!.t) / 0.05)))]?.ast ??
          { speech: 0, music: 0, target: 0 };
      } else {
        const avg = { speech: 0, music: 0, target: 0 };
        for (const f of fr) {
          avg.speech += f.ast.speech;
          avg.music += f.ast.music;
          avg.target += f.ast.target;
        }
        vals = avg;
      }
      const mx = Math.max(vals.speech, vals.music, vals.target, 1e-6);
      const labels: [string, number, string][] = [
        ['SPEECH', vals.speech / mx, LABEL_COLORS.speech],
        ['MUSIC', vals.music / mx, LABEL_COLORS.music],
        ['ENGINE', vals.target / mx, LABEL_COLORS.target],
      ];
      const bw = w / 3;
      labels.forEach(([name, v, color], i) => {
        const bh = Math.max(2, v * (H - 24));
        ctx.fillStyle = color;
        ctx.globalAlpha = v > 0.4 ? 1 : 0.45;
        ctx.fillRect(i * bw + bw * 0.2, H - bh - 14, bw * 0.6, bh);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#5a5a5a';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(name, i * bw + bw / 2, H - 2);
      });
    } else if (kind === 'vad') {
      const peaks = data.waveformPeaks;
      const inSpeech = (t: number) => data.spans.some((s) => s.label === 'speech' && t >= s.startSec && t < s.endSec);
      const mid = H / 2;
      for (let x = 0; x < w; x++) {
        const t = (x / w) * data.durationSec;
        const pk = peaks[Math.floor((x / w) * peaks.length)] ?? [0, 0];
        const sp = inSpeech(t);
        ctx.strokeStyle = sp ? LABEL_COLORS.speech : 'var(--border-strong)';
        ctx.globalAlpha = sp ? 0.9 : 0.4;
        ctx.beginPath();
        ctx.moveTo(x, mid + pk[0] * (H / 2 - 4));
        ctx.lineTo(x, mid + pk[1] * (H / 2 - 4));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (p != null) drawPlayhead(ctx, p * w);
    }
  }

  function drawPlayhead(ctx: CanvasRenderingContext2D, x: number) {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  $effect(() => {
    // Redraw on size/data/buffer change, and on every tick of the SHARED clock while playing
    // (transport.frame) — and when play/pause toggles, so it settles to the static state.
    void w;
    void specBuf;
    transport?.frame;
    void transport?.playing;
    render();
  });
</script>

<div class="tool-demo" bind:this={wrap}>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  {#if caption}
    {#if kind === 'filters'}
      <p class="cap">
        <span class="key"><span class="sw" style:background="var(--accent)"></span> loudness</span>
        <span class="key"><span class="sw" style:background="#b0423e"></span> noise-likeness</span>
        <span class="txt">{caption}</span>
      </p>
    {:else}
      <p class="cap"><span class="txt">{caption}</span></p>
    {/if}
  {/if}
</div>

<style>
  .tool-demo {
    width: 100%;
    margin-top: var(--space-sm);
  }
  canvas {
    width: 100%;
    height: 96px;
    display: block;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  .cap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm) var(--space-md);
    margin-top: var(--space-xs);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink);
  }
  .sw {
    width: 16px;
    height: 3px;
    display: inline-block;
    border-radius: 2px;
  }
  .txt {
    flex: 1 1 200px;
  }
</style>
