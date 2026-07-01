<script lang="ts">
  import type { ClipData } from '../data';
  import { claimAudio, releaseAudio } from '../audio/transport.svelte';

  let { data }: { data: ClipData } = $props();

  // The target survives as several chunks; sum them.
  const targetSpans = $derived(data.spans.filter((s) => s.label === 'target' && s.kept));
  const keptSec = $derived(targetSpans.reduce((a, s) => a + (s.endSec - s.startSec), 0));
  const pct = $derived(Math.round((keptSec / data.durationSec) * 100));
  const targetStem = $derived(data.stems?.find((s) => s.label === 'target'));

  let audio: HTMLAudioElement | null = null;
  const stopBus = () => audio?.pause();
  function playTarget() {
    if (!targetStem) return;
    claimAudio(stopBus); // stop the mixture transport / any stem
    audio ??= new Audio(import.meta.env.BASE_URL + targetStem.audioUrl);
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }
  $effect(() => () => {
    audio?.pause();
    releaseAudio(stopBus);
  });

  // Clip changed: drop the cached target audio (it was bound to the previous clip).
  $effect(() => {
    void data.clip;
    audio?.pause();
    audio = null;
  });
</script>

<div class="result">
  <div class="stat">
    <span class="big">{keptSec.toFixed(1)}s</span>
    <span class="small">of {data.durationSec.toFixed(1)}s survived — {pct}% of the clip</span>
  </div>
  <button class="play" onclick={playTarget} disabled={!targetStem}>
    ▶ Play the target stream
  </button>
</div>

<style>
  .result {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .stat {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }
  .big {
    font-family: var(--font-serif);
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    color: var(--adv-pos);
  }
  .small {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .play {
    align-self: flex-start;
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
  .play:hover {
    background: var(--surface);
    border-color: var(--accent);
  }
  .play:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
