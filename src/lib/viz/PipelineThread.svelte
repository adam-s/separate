<script lang="ts">
  // A serpentine "lace" that snakes down through the pipeline stage headings: a
  // horizontal run with a directional arrow into each heading, alternating side each
  // stage (right, left, right, ...), connected by rounded drops at the rails. Measures
  // [data-stage] elements in its positioned parent; recomputes on resize.
  type Seg = { d: string };
  let svg: SVGSVGElement;
  let segs = $state<Seg[]>([]);
  let W = $state(0);
  let Hh = $state(0);

  const R = 12; // corner radius of the rounded right-angle routing
  const RAIL = 34; // how far OUT into the page margin the vertical run sits
  const GAP = 14; // breathing room between a heading edge and the line/arrow

  function measure() {
    const host = svg?.parentElement;
    if (!host) return;
    const heads = Array.from(host.querySelectorAll<HTMLElement>('[data-stage]'));
    if (heads.length < 2) return;
    W = host.clientWidth;
    Hh = host.clientHeight;

    const nodes = heads.map((h) => ({
      left: h.offsetLeft,
      right: h.offsetLeft + h.offsetWidth,
      y: h.offsetTop + h.offsetHeight / 2,
    }));

    const out: Seg[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const right = i % 2 === 0; // this drop hugs the right rail, next the left
      const a = nodes[i];
      const b = nodes[i + 1];
      const exitX = right ? a.right + GAP : a.left - GAP;
      const entryX = right ? b.right + GAP : b.left - GAP;
      const railX = right ? W + RAIL : -RAIL; // out in the page margin
      const dir = right ? 1 : -1; // outward toward the rail
      const sy = Math.sign(b.y - a.y) || 1;
      // exit heading horizontally -> rounded corner -> vertical run on the rail ->
      // rounded corner -> back into the next heading horizontally (arrow points inward).
      out.push({
        d:
          `M ${exitX} ${a.y} ` +
          `L ${railX - dir * R} ${a.y} ` +
          `Q ${railX} ${a.y} ${railX} ${a.y + sy * R} ` +
          `L ${railX} ${b.y - sy * R} ` +
          `Q ${railX} ${b.y} ${railX - dir * R} ${b.y} ` +
          `L ${entryX} ${b.y}`,
      });
    }
    segs = out;
  }

  $effect(() => {
    if (!svg?.parentElement) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(svg.parentElement);
    const t = setTimeout(measure, 300);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  });
</script>

<svg bind:this={svg} class="thread" width={W} height={Hh} aria-hidden="true">
  <defs>
    <!-- orient="auto" rotates the head to the path tangent so it reads as the lace's
         own pointed tip; refX at the tip aligns it flush with the line end. -->
    <marker id="lace-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto">
      <path d="M 1 1 L 11 6 L 1 11 L 4 6 z" fill="var(--accent)" />
    </marker>
  </defs>
  {#each segs as s, i (i)}
    <path
      d={s.d}
      fill="none"
      stroke="var(--accent)"
      stroke-width="1.6"
      stroke-dasharray="5 5"
      opacity="0.45"
      marker-end="url(#lace-arrow)"
    />
  {/each}
</svg>

<style>
  .thread {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    overflow: visible;
  }
</style>
