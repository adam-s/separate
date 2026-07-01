<script lang="ts">
  // A cheap, GPU-composited playhead overlay. Position is a 0..1 fraction; moving it
  // only updates one element's transform, so the heavy canvas/SVG underneath is never
  // redrawn per frame.
  let { frac, color = 'var(--ink)' }: { frac: number; color?: string } = $props();
</script>

<div
  class="playhead"
  style:left={`${Math.max(0, Math.min(1, frac)) * 100}%`}
  style:background={color}
  aria-hidden="true"
></div>

<style>
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--ink);
    pointer-events: none;
    will-change: left;
  }
</style>
