// CDP performance + leak probe. Uses the Chrome DevTools Protocol via Playwright to:
//  - measure JS heap, DOM node count, and JS event-listener count before/after many clip
//    switches (with forced GC) to expose leaks,
//  - count long tasks during playback,
//  - confirm the page is idle (no per-frame churn) when paused.
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5174/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const client = await page.context().newCDPSession(page);
await client.send('Performance.enable');
await client.send('HeapProfiler.enable');

const gc = () => client.send('HeapProfiler.collectGarbage');
async function metrics() {
  const { metrics } = await client.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return {
    heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2),
    nodes: m.Nodes,
    listeners: m.JSEventListeners,
    docs: m.Documents,
    layouts: m.LayoutCount,
    recalcs: m.RecalcStyleCount,
  };
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// longtask observer
await page.evaluate(() => {
  window.__lt = [];
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({
      entryTypes: ['longtask'],
    });
  } catch {}
});

const playBtn = page.locator('footer button').first();
const sel = page.locator('footer select').first();
const opts = await sel.locator('option').evaluateAll((els) => els.map((e) => e.value));

await gc();
await page.waitForTimeout(200);
const before = await metrics();

// stress: switch every clip + play a bit, several rounds. Sample per round to see if
// node/listener growth is linear (a leak) or one-time (lazy init that plateaus).
const ROUNDS = 6;
const trajectory = [];
for (let r = 0; r < ROUNDS; r++) {
  for (const v of opts) {
    await sel.selectOption(v);
    await page.waitForTimeout(250);
    await playBtn.click();
    await page.waitForTimeout(500);
    await playBtn.click();
  }
  await gc();
  const m = await metrics();
  trajectory.push({ round: r + 1, nodes: m.nodes, listeners: m.listeners, heapMB: m.heapMB });
}

await gc();
await page.waitForTimeout(300);
const after = await metrics();

// idle check: with nothing playing, layout/recalc should barely move over 1.5s
const idle1 = await metrics();
await page.waitForTimeout(1500);
const idle2 = await metrics();

// playback long tasks
await page.evaluate(() => (window.__lt = []));
await sel.selectOption(opts[0]);
await page.waitForTimeout(200);
await playBtn.click();
await page.waitForTimeout(3000);
await playBtn.click();
const longtasks = await page.evaluate(() => window.__lt);

const report = {
  switches: ROUNDS * opts.length,
  trajectory,
  before,
  after,
  delta: {
    heapMB: +(after.heapMB - before.heapMB).toFixed(2),
    nodes: after.nodes - before.nodes,
    listeners: after.listeners - before.listeners,
    docs: after.docs - before.docs,
  },
  idleOver1_5s: {
    layouts: idle2.layouts - idle1.layouts,
    recalcs: idle2.recalcs - idle1.recalcs,
    heapMB: +(idle2.heapMB - idle1.heapMB).toFixed(2),
  },
  playback3s: {
    longTaskCount: longtasks.length,
    longTaskMaxMs: longtasks.length ? Math.max(...longtasks) : 0,
    longTaskTotalMs: longtasks.reduce((a, b) => a + b, 0),
  },
};
console.log(JSON.stringify(report, null, 2));
await browser.close();
