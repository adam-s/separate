<script lang="ts">
  // Live capability readout for the reader's own device.
  let hasWebGPU = $state(false);
  let backend = $state('WASM (CPU)');
  let mem = $state<number | null>(null);

  $effect(() => {
    if (typeof navigator === 'undefined') return;
    hasWebGPU = 'gpu' in navigator;
    backend = hasWebGPU ? 'WebGPU (GPU)' : 'WASM (CPU)';
    mem = (navigator as { deviceMemory?: number }).deviceMemory ?? null;
  });

  const rows = $derived([
    { k: 'Acceleration', v: backend, ok: hasWebGPU },
    { k: 'Device memory', v: mem ? `~${mem} GB` : 'not reported', ok: true },
    { k: 'Where models cache', v: 'Cache Storage (this device)', ok: true },
    { k: 'Your audio', v: 'never leaves the browser', ok: true },
  ]);
</script>

<dl class="panel">
  {#each rows as r}
    <div class="row">
      <dt>{r.k}</dt>
      <dd class:ok={r.ok}>{r.v}</dd>
    </div>
  {/each}
</dl>

<style>
  .panel {
    display: grid;
    gap: 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--border);
  }
  dt {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  dd {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--ink);
    text-align: right;
  }
  dd.ok {
    color: var(--adv-pos);
  }
</style>
