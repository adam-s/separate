<script lang="ts">
  import type { ClipInfo } from '../data';

  let {
    clips,
    active,
    onpick,
  }: { clips: ClipInfo[]; active: string; onpick: (slug: string) => void } = $props();
</script>

<div class="picker" role="radiogroup" aria-label="Choose a recording">
  {#each clips as c}
    <div class="card" class:active={c.slug === active}>
      <button
        class="pick"
        role="radio"
        aria-checked={c.slug === active}
        onclick={() => onpick(c.slug)}
      >
        <span class="title">{c.title}</span>
        <span class="meta">
          {c.durationSec.toFixed(0)}s · {c.mix.speech}% speech · {c.mix.music}% music · {c.mix.target}% engine
        </span>
      </button>
      <a class="src" href={c.url} target="_blank" rel="noopener" title="Watch the original">
        {c.source} ↗
      </a>
    </div>
  {/each}
</div>

<style>
  .picker {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-sm);
    margin: var(--space-md) 0;
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--bg);
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .card.active {
    border-color: var(--accent);
    background: var(--surface);
  }
  .pick {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-md) var(--space-md) var(--space-sm);
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    min-height: 44px;
  }
  .pick:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .title {
    font-family: var(--font-serif);
    font-size: var(--text-base);
    color: var(--ink);
  }
  .card.active .title {
    color: var(--accent);
  }
  .meta {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-subtle);
  }
  .src {
    align-self: flex-start;
    margin: 0 var(--space-md) var(--space-sm);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    color: var(--ink-muted);
    border-bottom: none;
  }
  .src:hover {
    color: var(--accent);
  }
</style>
