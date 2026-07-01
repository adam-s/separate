<script lang="ts">
  import type { Transport } from '../audio/transport.svelte';
  let { transport }: { transport: Transport } = $props();

  function fmt(t: number): string {
    const s = Math.floor(t);
    const cs = Math.floor((t - s) * 10);
    return `0:0${s}.${cs}`.replace(/0:0(\d\d)/, '0:$1');
  }
</script>

<div class="controls">
  <button
    class="play"
    data-action="play"
    aria-label={transport.playing ? 'Pause' : 'Play'}
    onclick={() => transport.toggle()}
  >
    {#if transport.playing}❚❚{:else}▶{/if}
  </button>
  <input
    class="scrub"
    type="range"
    min="0"
    max={transport.duration}
    step="0.01"
    value={transport.t}
    aria-label="Seek"
    oninput={(e) => transport.seek(+(e.target as HTMLInputElement).value)}
  />
  <span class="time">{fmt(transport.t)} / {fmt(transport.duration)}</span>
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-top: var(--space-md);
  }
  .play {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid var(--border-strong);
    background: var(--bg);
    color: var(--ink);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .play:hover {
    background: var(--surface);
    border-color: var(--accent);
  }
  .play:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .scrub {
    flex: 1;
    accent-color: var(--accent);
    height: 4px;
    cursor: pointer;
  }
  .time {
    flex: none;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
