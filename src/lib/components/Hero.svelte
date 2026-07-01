<script lang="ts">
  let { title, lede }: { title: string; lede: string } = $props();
</script>

<header class="hero">
  <h1>{title}</h1>
  <p class="lede">{lede}</p>
</header>

<style>
  .hero {
    padding: var(--space-3xl) 0 var(--space-lg);
  }
  h1 {
    margin-bottom: var(--space-md);
  }
  .lede {
    font-style: italic;
    font-size: var(--text-lg);
    line-height: var(--leading-snug);
    color: var(--ink-muted);
    max-width: var(--measure);
  }
  @media (max-width: 768px) {
    .hero {
      padding: var(--space-2xl) 0 var(--space-md);
    }
  }
</style>
