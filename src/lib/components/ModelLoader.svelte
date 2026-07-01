<script lang="ts">
  import { recognizer } from '../audio/recognizer.svelte';

  // The progressive-enhancement gate: on a capable device, offer to download the real
  // recognizer (with progress), then run it live on the current clip. On anything else,
  // the precomputed walkthrough above is the whole experience.
  let { audioUrl, capable }: { audioUrl: string; capable: boolean } = $props();

  let result = $state<{ label: string; score: number }[]>([]);
  let analyzing = $state(false);

  async function analyze() {
    analyzing = true;
    try {
      result = await recognizer.classify(audioUrl, 6);
    } finally {
      analyzing = false;
    }
  }

  const files = $derived(Object.entries(recognizer.files));
</script>

<div class="loader">
  {#if !capable}
    <p class="note">
      Running the model live needs a desktop with WebGPU (Chrome or Edge). On this device
      the panels above are precomputed — they cover the whole method regardless.
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
    <button class="go" onclick={analyze} disabled={analyzing || !audioUrl}>
      {analyzing ? 'Listening…' : '▶ Run it on this clip'}
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
        Live predictions — the raw AudioSet classes, computed on your device just now,
        not read from a precomputed file like the panels above.
      </p>
    {/if}
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
  .note,
  .hint {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
</style>
