<script lang="ts">
  import type { Snippet } from 'svelte';
  import { reveal } from '../actions/reveal';
  let {
    id,
    n,
    title,
    children,
  }: { id: string; n: number; title: string; children?: Snippet } = $props();
</script>

<section {id} class="section" use:reveal>
  <p class="kicker">{String(n).padStart(2, '0')}</p>
  <h2>{title}</h2>
  <div class="body">
    {#if children}{@render children()}{:else}
      <p class="stub">Section content lands in a later iteration.</p>
    {/if}
  </div>
</section>

<style>
  .section {
    padding: var(--space-2xl) 0 0;
    scroll-margin-top: var(--space-lg);
  }
  .kicker {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-subtle);
    margin-bottom: var(--space-sm);
  }
  h2 {
    margin-bottom: var(--space-lg);
  }
  .body :global(p) {
    max-width: var(--measure);
    margin-bottom: var(--space-md);
    color: var(--ink);
  }
  .body :global(h3) {
    max-width: var(--measure);
    margin: var(--space-xl) 0 var(--space-xs);
    font-size: var(--text-lg);
  }
  /* Pipeline block: just a positioning context for the serpentine "lace" overlay.
     No layout change — the lace routes out into the page margins (overflow visible). */
  .body :global(.pipeline) {
    position: relative;
  }
  .stub {
    color: var(--ink-subtle);
    font-style: italic;
  }
  @media (max-width: 768px) {
    .section {
      padding: var(--space-xl) 0 0;
    }
  }
</style>
