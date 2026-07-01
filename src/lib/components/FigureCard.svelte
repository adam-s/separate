<script lang="ts">
  import type { Snippet } from 'svelte';
  let { label, children }: { label: string; children: Snippet } = $props();
</script>

<figure class="card">
  <div class="label">{label}</div>
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
  .label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-subtle);
    margin-bottom: var(--space-md);
  }
  @media (max-width: 768px) {
    .card {
      padding: var(--space-md);
    }
  }
</style>
