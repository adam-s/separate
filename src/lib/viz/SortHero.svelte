<script lang="ts">
  import { flip } from 'svelte/animate';
  import { LABEL_COLORS, type Label } from '../data';

  // Abstract statement of the goal: a mixed stream 1 2 3 1 2 3 1 2 3 sorted into
  // 1 1 1 · 2 2 2 · 3 3 3. No audio knowledge required.
  const CLASS_LABEL: Record<number, Label> = { 1: 'speech', 2: 'music', 3: 'target' };
  const N = 3;

  type Block = { id: number; cid: number };
  const interleaved: Block[] = [];
  let k = 0;
  for (let c = 0; c < N; c++) for (let cid = 1; cid <= 3; cid++) interleaved.push({ id: k++, cid });
  const grouped = [...interleaved].sort((a, b) => a.cid - b.cid || a.id - b.id);

  let isGrouped = $state(false);
  let blocks = $state<Block[]>(interleaved);

  const reduce =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flipDur = reduce ? 0 : 600;

  function toggle() {
    isGrouped = !isGrouped;
    blocks = isGrouped ? grouped : interleaved;
  }
</script>

<div class="hero-sort">
  <div class="row" class:grouped={isGrouped}>
    {#each blocks as b (b.id)}
      <div
        class="block"
        style:background={LABEL_COLORS[CLASS_LABEL[b.cid]]}
        animate:flip={{ duration: flipDur }}
      >
        {b.cid}
      </div>
    {/each}
  </div>

  <div class="controls">
    <button onclick={toggle}>
      {isGrouped ? '← Shuffle back' : 'Sort into groups →'}
    </button>
    <span class="caption">
      {isGrouped
        ? 'Sorted into groups. Now discard speech (1) and music (2); what is left (3) is the signal we keep.'
        : 'A mixed stream: speech (1), music (2), and the target (3), interleaved. The goal is to drop 1 and 2.'}
    </span>
  </div>
</div>

<style>
  .hero-sort {
    width: 100%;
  }
  .row {
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    justify-content: center;
    padding: var(--space-lg) 0;
  }
  /* Visual gap between the three groups once sorted. */
  .row.grouped .block:nth-child(3),
  .row.grouped .block:nth-child(6) {
    margin-right: var(--space-lg);
  }
  .block {
    flex: 1 1 0;
    max-width: 64px;
    aspect-ratio: 3 / 4;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
    box-shadow: var(--shadow-hairline);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-md);
    margin-top: var(--space-sm);
  }
  button {
    flex: none;
    min-height: 44px;
    padding: 0 var(--space-lg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  button:hover {
    background: var(--surface);
    border-color: var(--accent);
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .caption {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-muted);
    flex: 1 1 240px;
  }
</style>
