<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    label,
    badge,
    badgeTone = 'muted',
    children,
  }: {
    label: string;
    badge?: string;
    badgeTone?: 'muted' | 'live';
    children: Snippet;
  } = $props();
</script>

<figure class="card">
  <div class="head">
    <div class="label">{label}</div>
    {#if badge}
      <span class="badge" class:live={badgeTone === 'live'}>{badge}</span>
    {/if}
  </div>
  {@render children()}
</figure>

<style>
  .card {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg);
    padding: var(--space-lg);
    margin: var(--space-lg) 0;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }
  .label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-subtle);
  }
  .badge {
    flex: none;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-subtle);
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    padding: 2px 9px;
    white-space: nowrap;
  }
  /* "live" = the model is running on this device right now, not precomputed. */
  .badge.live {
    color: var(--adv-pos);
    border-color: var(--adv-pos);
    background: var(--adv-pos-soft);
  }
  .badge.live::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 5px;
    border-radius: 50%;
    background: var(--adv-pos);
    vertical-align: middle;
  }
  @media (max-width: 768px) {
    .card {
      padding: var(--space-md);
    }
  }
</style>
