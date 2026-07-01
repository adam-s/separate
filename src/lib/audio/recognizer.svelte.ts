/**
 * The live recognizer: downloads the AST audio-classification model with transformers.js
 * and runs it in the browser. State is reactive so the UI can show a download gate,
 * per-file progress, and the cached/ready state. transformers.js is dynamically imported
 * so it stays out of the initial bundle until the reader opts in.
 *
 * It can also run the model *across* a clip — a sliding window, exactly like
 * scripts/prepare_clips.py — to produce the per-slice speech/music/engine scores the
 * visualizations draw. When the reader opts in, those live values replace the precomputed
 * ones, so the same panels run on their own GPU.
 */
import type { Frame, Label } from '../data';

const MODEL = 'Xenova/ast-finetuned-audioset-10-10-0.4593';
// ~90 MB model weights + ~22 MB ONNX Runtime wasm on first load.
const SIZE_MB = 112;

// Serve the ONNX Runtime wasm from jsDelivr instead of self-hosting the ~22 MB blob.
// The version MUST match the onnxruntime-web that @huggingface/transformers resolves to
// (check `node_modules/onnxruntime-web/package.json`); a mismatch breaks inference.
const ORT_VERSION = '1.26.0-dev.20260416-b7804b056c';
const ORT_WASM_CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

// Slide the AST across the clip the same way scripts/prepare_clips.py does, so the live
// numbers line up with the precomputed ones: a 1.4 s window every 0.5 s, top-25 classes
// bucketed into speech / music / engine by keyword.
const SR = 16000;
const WIN = 1.4;
const HOP = 0.5;
const MIN = 0.3; // shortest trailing window worth scoring
const HOP_T = 0.05; // the fine grid the ribbon/readouts index into

const SPEECH_KW = ['speech', 'narrat', 'conversation'];
const MUSIC_KW = ['music', 'instrument', 'singing', 'guitar', 'drum', 'bass ', 'hip hop', 'electronic', 'song', 'synth'];
const ENGINE_KW = ['engine', 'vehicle', 'car', 'motor', 'idl', 'acceler', 'knock', 'rev', 'truck', 'machine'];

function bucket(res: { label: string; score: number }[]): [number, number, number] {
  let s = 0, m = 0, e = 0;
  for (const r of res) {
    const l = r.label.toLowerCase();
    if (SPEECH_KW.some((k) => l.includes(k))) s += r.score;
    else if (MUSIC_KW.some((k) => l.includes(k))) m += r.score;
    else if (ENGINE_KW.some((k) => l.includes(k))) e += r.score;
  }
  const t = s + m + e;
  return t > 1e-6 ? [s / t, m / t, e / t] : [0, 0, 0];
}

// Resample the coarse window scores onto the 0.05 s frame grid the viz expect, picking the
// nearest window for each frame (the browser mirror of prepare_clips.py's scores_at).
function toFrames(raw: { tC: number; s: number; m: number; e: number }[], dur: number): Frame[] {
  const n = Math.max(1, Math.round(dur / HOP_T));
  const frames: Frame[] = [];
  for (let i = 0; i < n; i++) {
    const t = i * HOP_T;
    let best = raw[0];
    let bd = Infinity;
    for (const w of raw) {
      const d = Math.abs(w.tC - t);
      if (d < bd) { bd = d; best = w; }
    }
    const ranked: [number, Label][] = [[best.s, 'speech'], [best.m, 'music'], [best.e, 'target']];
    ranked.sort((a, b) => b[0] - a[0]);
    const label: Label = ranked[0][0] < 0.02 ? 'silence' : ranked[0][1];
    frames.push({
      tSec: +t.toFixed(3),
      rms: 0,
      flatness: 0,
      ast: { speech: best.s, music: best.m, target: best.e },
      label,
    });
  }
  return frames;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';
type ClfInput = string | Float32Array;
type Clf = (input: ClfInput, opts?: { top_k?: number }) => Promise<{ label: string; score: number }[]>;
type TJS = typeof import('@huggingface/transformers');

export class Recognizer {
  status = $state<Status>('idle');
  pct = $state(0);
  files = $state<Record<string, { loaded: number; total: number }>>({});
  error = $state('');
  backend = $state<'WebGPU' | 'WASM'>('WASM');
  readonly sizeMb = SIZE_MB;

  // Live per-slice results keyed by clip slug, plus the reader's opt-in to show them.
  windows = $state<Record<string, Frame[]>>({});
  winRunning = $state(false);
  winPct = $state(0);
  winSlug = $state('');
  preferLive = $state(false);

  #clf: Clf | null = null;
  #tjs: TJS | null = null;

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  /** The live per-slice frames for a clip, if the reader has opted into live mode. */
  liveFramesFor(slug: string): Frame[] | undefined {
    return this.preferLive ? this.windows[slug] : undefined;
  }

  async load(): Promise<void> {
    if (this.#clf || this.status === 'loading') return;
    this.status = 'loading';
    this.backend = this.supported ? 'WebGPU' : 'WASM';
    try {
      const TJS = await import('@huggingface/transformers');
      this.#tjs = TJS;
      TJS.env.allowLocalModels = false;
      if (TJS.env.backends?.onnx?.wasm) TJS.env.backends.onnx.wasm.wasmPaths = ORT_WASM_CDN;
      const cb = (e: { status?: string; file?: string; loaded?: number; total?: number }) => {
        if (!e.file) return;
        this.files = { ...this.files, [e.file]: { loaded: e.loaded ?? 0, total: e.total ?? 0 } };
        const vals = Object.values(this.files);
        const loaded = vals.reduce((a, f) => a + f.loaded, 0);
        const total = vals.reduce((a, f) => a + f.total, 0);
        this.pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : this.pct;
      };
      this.#clf = (await TJS.pipeline('audio-classification', MODEL, {
        device: this.supported ? 'webgpu' : 'wasm',
        dtype: this.supported ? 'fp32' : 'q8',
        progress_callback: cb,
      })) as unknown as Clf;
      this.pct = 100;
      this.status = 'ready';
    } catch (e) {
      this.status = 'error';
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  async classify(url: string, topk = 6): Promise<{ label: string; score: number }[]> {
    await this.load();
    if (!this.#clf) return [];
    return this.#clf(url, { top_k: topk });
  }

  /**
   * Run the recognizer across a whole clip, live, and store the per-slice scores so the
   * visualizations can switch from precomputed to live. Mirrors prepare_clips.py's
   * ast_windows(): a 1.4 s window every 0.5 s, bucketed by keyword.
   */
  async runWindows(slug: string, url: string, durationSec: number): Promise<void> {
    await this.load();
    if (!this.#clf || !this.#tjs) return;
    this.winRunning = true;
    this.winPct = 0;
    this.winSlug = slug;
    try {
      const audio = await this.#tjs.read_audio(url, SR);
      const win = Math.round(WIN * SR);
      const hop = Math.round(HOP * SR);
      const minLen = Math.round(MIN * SR);
      const nWin = Math.max(1, Math.floor((audio.length - minLen) / hop) + 1);
      const raw: { tC: number; s: number; m: number; e: number }[] = [];
      let done = 0;
      for (let a = 0; a + minLen <= audio.length; a += hop) {
        const seg = audio.subarray(a, Math.min(a + win, audio.length)) as Float32Array;
        const res = await this.#clf(seg, { top_k: 25 });
        const [s, m, e] = bucket(res);
        raw.push({ tC: a / SR + WIN / 2, s, m, e });
        this.winPct = Math.round((++done / nWin) * 100);
      }
      if (!raw.length) raw.push({ tC: durationSec / 2, s: 0, m: 0, e: 1 });
      this.windows = { ...this.windows, [slug]: toFrames(raw, durationSec) };
      this.preferLive = true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.winRunning = false;
    }
  }
}

export const recognizer = new Recognizer();
