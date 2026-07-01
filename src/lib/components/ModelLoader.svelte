<script lang="ts">
  import { recognizer } from '../audio/recognizer.svelte';

  // The progressive-enhancement gate: on a capable device, offer to download the real
  // recognizer (with progress), then run it live on the current clip. On anything else,
  // the precomputed walkthrough is the whole experience.
  let {
    audioUrl,
    slug,
    durationSec,
    capable,
  }: { audioUrl: string; slug: string; durationSec: number; capable: boolean } = $props();

  let result = $state<{ label: string; score: number }[]>([]);
  let analyzing = $state(false);

  // Slide the model across the whole clip; the per-slice recognizer panel then reads these.
  async function runLive() {
    await recognizer.runWindows(slug, audioUrl, durationSec);
  }

  // The raw AudioSet classes for the whole clip — the model's unbucketed output.
  async function analyze() {
    analyzing = true;
    try {
      result = await recognizer.classify(audioUrl, 6);
    } finally {
      analyzing = false;
    }
  }

  const files = $derived(Object.entries(recognizer.files));
  const hasLive = $derived(!!recognizer.windows[slug]);
</script>

<div class="loader">
  {#if !capable}
    <p class="note">
      Running the model live needs a desktop with WebGPU (Chrome or Edge). On this device
      the walkthrough that follows is precomputed — it covers the whole method regardless.
    </p>
  {:else if recognizer.status === 'idle'}
    <button class="go" onclick={() => recognizer.load()}>
      ▶ Download the recognizer · ~{recognizer.sizeMb} MB
    </button>
    <p class="hint">Downloads once, caches in your browser, then runs on your GPU.</p>
  {:else if recognizer.status === 'loading'}
    <div class="progress">
      <div class="bar"><span style:width={`${recognizer.pct}%`}></span></div>
      <span class="pct">{recognizer.pct}%</span>
    </div>
    <ul class="files">
      {#each files as [name, f]}
        <li>
          <span class="fname">{name.split('/').pop()}</span>
          <span class="fsize">{(f.loaded / 1e6).toFixed(1)} / {(f.total / 1e6).toFixed(1)} MB</span>
        </li>
      {/each}
    </ul>
    <p class="hint">Downloading on the {recognizer.backend} backend. Cached after this, so the next visit is instant.</p>
  {:else if recognizer.status === 'ready'}
    <p class="ready">✓ Loaded · running on {recognizer.backend}, on your device. Nothing you run here is uploaded.</p>
    {#if recognizer.winRunning}
      <div class="progress">
        <div class="bar"><span style:width={`${recognizer.winPct}%`}></span></div>
        <span class="pct">{recognizer.winPct}%</span>
      </div>
      <p class="hint">Sliding the model across the clip in 1.4-second windows, live on your GPU…</p>
    {:else}
      <button class="go" onclick={runLive} disabled={!audioUrl}>
        {hasLive ? '↻ Run across your clip again' : '▶ Run it across your clip, live'}
      </button>
      {#if hasLive}
        <p class="ready">✓ The recognizer panel below is live now — every slice scored on your device.</p>
        <div class="toggle" role="group" aria-label="Recognizer panel source">
          <button type="button" class:on={recognizer.preferLive} onclick={() => (recognizer.preferLive = true)}>
            live
          </button>
          <button type="button" class:on={!recognizer.preferLive} onclick={() => (recognizer.preferLive = false)}>
            precomputed
          </button>
        </div>
      {:else}
        <p class="hint">
          Slides the model over the whole clip and lights up the per-slice recognizer panel
          below with your GPU's own numbers, not the precomputed ones.
        </p>
      {/if}
    {/if}
    <details class="raw">
      <summary>See the raw AudioSet classes for the whole clip</summary>
      <button class="go small" onclick={analyze} disabled={analyzing || !audioUrl}>
        {analyzing ? 'Listening…' : 'Classify the whole clip'}
      </button>
      {#if result.length}
        <ul class="result">
          {#each result as r}
            <li>
              <span class="rlabel">{r.label}</span>
              <span class="rbar"><span style:width={`${Math.round(r.score * 100)}%`}></span></span>
              <span class="rscore">{Math.round(r.score * 100)}%</span>
            </li>
          {/each}
        </ul>
        <p class="hint">
          The model's own top classes, out of the 500-plus in AudioSet — computed on your
          device just now. The panels bucket these into speech / music / engine.
        </p>
      {/if}
    </details>
  {:else if recognizer.status === 'error'}
    <p class="note">Couldn't load the model: {recognizer.error}</p>
  {/if}
</div>

<style>
  .loader {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: var(--space-md) 0;
  }
  .go {
    align-self: flex-start;
    min-height: 44px;
    padding: 0 var(--space-lg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .go:hover:not(:disabled) {
    background: var(--surface);
    border-color: var(--accent);
  }
  .go:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .bar {
    flex: 1;
    height: 8px;
    background: var(--surface-muted);
    border-radius: 4px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.2s ease;
  }
  .pct {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--ink-muted);
    min-width: 3em;
    text-align: right;
  }
  .files {
    list-style: none;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-subtle);
  }
  .files li {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
  }
  .result {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .result li {
    display: grid;
    grid-template-columns: 9em 1fr 3em;
    align-items: center;
    gap: var(--space-sm);
  }
  .rlabel {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink);
  }
  .rbar {
    height: 6px;
    background: var(--surface-muted);
    border-radius: 3px;
    overflow: hidden;
  }
  .rbar span {
    display: block;
    height: 100%;
    background: var(--adv-pos);
  }
  .rscore {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-muted);
    text-align: right;
  }
  .ready {
    color: var(--adv-pos);
    font-family: var(--font-sans);
  }
  .toggle {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    overflow: hidden;
    align-self: flex-start;
  }
  .toggle button {
    min-height: 36px;
    padding: 0 var(--space-md);
    border: none;
    background: var(--bg);
    color: var(--ink-muted);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    cursor: pointer;
  }
  .toggle button + button {
    border-left: 1px solid var(--border-strong);
  }
  .toggle button.on {
    background: var(--adv-pos-soft);
    color: var(--adv-pos);
  }
  .raw {
    margin-top: var(--space-xs);
  }
  .raw summary {
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .raw summary:hover {
    color: var(--accent);
  }
  .raw[open] summary {
    margin-bottom: var(--space-sm);
  }
  .go.small {
    min-height: 36px;
    font-size: var(--text-xs);
  }
  .note,
  .hint {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
</style>
