/**
 * The live recognizer: downloads the AST audio-classification model with transformers.js
 * and runs it in the browser. State is reactive so the UI can show a download gate,
 * per-file progress, and the cached/ready state. transformers.js is dynamically imported
 * so it stays out of the initial bundle until the reader opts in.
 */
const MODEL = 'Xenova/ast-finetuned-audioset-10-10-0.4593';
const SIZE_MB = 90;

type Status = 'idle' | 'loading' | 'ready' | 'error';
type Clf = (url: string, opts?: { top_k?: number }) => Promise<{ label: string; score: number }[]>;

export class Recognizer {
  status = $state<Status>('idle');
  pct = $state(0);
  files = $state<Record<string, { loaded: number; total: number }>>({});
  error = $state('');
  backend = $state<'WebGPU' | 'WASM'>('WASM');
  readonly sizeMb = SIZE_MB;

  #clf: Clf | null = null;

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  async load(): Promise<void> {
    if (this.#clf || this.status === 'loading') return;
    this.status = 'loading';
    this.backend = this.supported ? 'WebGPU' : 'WASM';
    try {
      const TJS = await import('@huggingface/transformers');
      TJS.env.allowLocalModels = false;
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
}

export const recognizer = new Recognizer();
