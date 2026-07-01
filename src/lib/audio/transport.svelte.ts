/**
 * The single playback clock for the whole page.
 *
 * One persistent <audio> element, one AudioContext, one AnalyserNode, created once and
 * reused across clips (so switching clips never leaks AudioContexts). One rAF loop drives
 * the reactive playhead `t` and a `frame` counter; every visual reads those and redraws in
 * lockstep, so nothing can drift out of sync. A clip change just calls load() — the same
 * transport object stays referenced everywhere.
 *
 * Isolated stems (auditioning one separated source) play through a global one-at-a-time
 * bus so starting a stem stops the main transport and vice versa.
 */

// --- global exclusive-audio bus: starting one source stops the previous ---
let currentStop: (() => void) | null = null;
export function claimAudio(stop: () => void) {
  if (currentStop && currentStop !== stop) currentStop();
  currentStop = stop;
}
export function releaseAudio(stop: () => void) {
  if (currentStop === stop) currentStop = null;
}

export class Transport {
  playing = $state(false);
  /** Current playback position in seconds. Read this for declarative bindings (SVG/DOM playheads). */
  t = $state(0);
  duration = $state(0);
  /** Bumped once per rAF tick while playing. Depend on this to trigger imperative canvas redraws. */
  frame = $state(0);

  #raf = 0;
  #audio: HTMLAudioElement | null = null;
  #stopAt: number | null = null;

  // one shared analyser over the single audio element
  #ctx: AudioContext | null = null;
  #analyser: AnalyserNode | null = null;
  #freq: Uint8Array<ArrayBuffer> | null = null;
  #connected = false;
  #stop = () => this.pause();

  #ensureAudio(): HTMLAudioElement | null {
    if (this.#audio || typeof Audio === 'undefined') return this.#audio;
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('ended', () => this.pause());
    a.addEventListener('error', () => this.pause()); // don't let the rAF loop spin on a media error
    a.addEventListener('loadedmetadata', () => {
      if (this.#audio && isFinite(this.#audio.duration)) this.duration = this.#audio.duration;
    });
    this.#audio = a;
    return a;
  }

  /** Point the transport at a new clip. Reuses the same element/graph. */
  load(audioUrl: string, duration: number) {
    if (currentStop) currentStop(); // stop the main OR any stem currently auditioning on the bus
    this.pause();
    this.duration = duration;
    this.t = 0;
    const a = this.#ensureAudio();
    if (a) {
      a.src = audioUrl;
      a.load();
    }
  }

  /** Lazily build the WebAudio graph (must follow a user gesture). Connected once. */
  #ensureAnalyser() {
    if (this.#connected || !this.#audio || typeof AudioContext === 'undefined') return;
    this.#ctx = new AudioContext();
    const src = this.#ctx.createMediaElementSource(this.#audio);
    this.#analyser = this.#ctx.createAnalyser();
    this.#analyser.fftSize = 1024;
    this.#analyser.smoothingTimeConstant = 0.8;
    this.#freq = new Uint8Array(new ArrayBuffer(this.#analyser.frequencyBinCount));
    src.connect(this.#analyser);
    this.#analyser.connect(this.#ctx.destination);
    this.#connected = true;
  }

  /** Live frequency data from the shared analyser (or null before first play). */
  freq(): Uint8Array<ArrayBuffer> | null {
    if (!this.#analyser || !this.#freq) return null;
    this.#analyser.getByteFrequencyData(this.#freq);
    return this.#freq;
  }
  get sampleRate(): number {
    return this.#ctx?.sampleRate ?? 48000;
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  play() {
    if (this.playing) return;
    claimAudio(this.#stop); // stop any other source (a stem)
    this.#ensureAnalyser();
    void this.#ctx?.resume();
    this.#stopAt = null;
    if (this.t >= this.duration - 0.01) this.seek(0);
    this.playing = true;
    if (this.#audio) {
      this.#audio.currentTime = this.t;
      void this.#audio.play().catch(() => {});
    }
    this.#tick();
  }

  /** Play only [start, end] then pause — used to audition an isolated span. */
  playRegion(start: number, end: number) {
    this.pause();
    claimAudio(this.#stop);
    this.#ensureAnalyser();
    void this.#ctx?.resume();
    this.seek(start);
    this.#stopAt = end;
    this.playing = true;
    if (this.#audio) {
      this.#audio.currentTime = start;
      void this.#audio.play().catch(() => {});
    }
    this.#tick();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.#raf);
    this.#audio?.pause();
    releaseAudio(this.#stop);
  }

  seek(t: number) {
    const clamped = Math.max(0, Math.min(this.duration, t));
    this.t = clamped;
    if (this.#audio) this.#audio.currentTime = clamped;
  }

  #tick = () => {
    if (this.#audio) this.t = this.#audio.currentTime;
    this.frame++;
    if (this.#stopAt != null && this.t >= this.#stopAt) {
      this.#stopAt = null;
      this.pause();
      return;
    }
    if (this.t >= this.duration - 0.01 && !this.#audio) {
      this.pause();
      return;
    }
    this.#raf = requestAnimationFrame(this.#tick);
  };

  destroy() {
    this.pause();
    if (this.#audio) this.#audio.src = '';
    void this.#ctx?.close();
  }
}
