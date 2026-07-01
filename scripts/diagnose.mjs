// Behavioral + sync probe. Drives the real page and asserts:
//  1) no console / runtime errors,
//  2) pressing play actually advances the clock (footer time text),
//  3) the canvases animate together while playing and freeze when paused,
//  4) switching through every clip repeatedly never throws (AudioContext reuse).
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5174/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const out = { errors: [], steps: {} };

const timeText = () => page.locator('footer .time').first().textContent().catch(() => null);
const canvasHashes = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('canvas')].map((c) => {
      try {
        return c.toDataURL().length + ':' + c.toDataURL().slice(120, 180);
      } catch {
        return 'x';
      }
    })
  );

// 1) press footer play, confirm the clock advances
const playBtn = page.locator('footer button').first();
await playBtn.click();
await page.waitForTimeout(250);
const t1 = await timeText();
const h1 = await canvasHashes();
await page.waitForTimeout(1100);
const t2 = await timeText();
const h2 = await canvasHashes();
out.steps.clockAdvanced = { t1, t2, advanced: t1 !== t2 };
const changed = h1.map((h, i) => h !== h2[i]);
out.steps.canvasesAnimating = { total: h1.length, changedWhilePlaying: changed.filter(Boolean).length };

// 2) pause -> canvases should freeze
await playBtn.click();
await page.waitForTimeout(150);
const p1 = await canvasHashes();
await page.waitForTimeout(700);
const p2 = await canvasHashes();
out.steps.frozenWhenPaused = {
  changedWhilePaused: p1.map((h, i) => h !== p2[i]).filter(Boolean).length,
};

// 2.5) section playheads (DOM, in the run/extract sections) move with the clock
try {
  await page.locator('#run').scrollIntoViewIfNeeded();
  const heads = () =>
    page.$$eval('.playhead', (els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
  await playBtn.click(); // play
  await page.waitForTimeout(300);
  const a = await heads();
  await page.waitForTimeout(900);
  const b = await heads();
  await playBtn.click(); // pause
  out.steps.sectionPlayheads = {
    count: a.length,
    movedWhilePlaying: a.filter((x, i) => x !== b[i]).length,
  };
} catch (e) {
  out.steps.sectionPlayheads = `THREW ${e.message}`;
}

// 3) stress clip switching (each clip x2), play each, confirm advance + no throw
const sel = page.locator('footer select').first();
const opts = await sel.locator('option').evaluateAll((els) => els.map((e) => e.value));
out.steps.clips = opts;
const switches = [];
for (let round = 0; round < 2; round++) {
  for (const v of opts) {
    await sel.selectOption(v);
    await page.waitForTimeout(400);
    await playBtn.click();
    await page.waitForTimeout(600);
    const a = await timeText();
    await playBtn.click(); // pause
    switches.push(`${v}:${a}`);
  }
}
out.steps.switchPlay = switches;

// 4) stem vs main mutual exclusion (the one-at-a-time bus)
try {
  await sel.selectOption(opts[0]);
  await page.waitForTimeout(400);
  const stem = page.locator('button.stem').first();
  if ((await stem.count()) > 0) {
    await stem.scrollIntoViewIfNeeded();
    await playBtn.click(); // main plays
    await page.waitForTimeout(500);
    const mainBefore = await timeText();
    await stem.click(); // stem should stop main
    await page.waitForTimeout(700);
    const mainAfter = await timeText();
    const stemActive = await stem.evaluate((el) => el.classList.contains('active'));
    await playBtn.click(); // main reclaims -> stem should stop
    await page.waitForTimeout(400);
    const stemActiveAfterMain = await stem.evaluate((el) => el.classList.contains('active'));
    out.steps.stemExclusion = {
      mainFrozenWhileStem: mainBefore === mainAfter,
      stemActiveWhilePlaying: stemActive,
      stemStoppedWhenMainResumes: !stemActiveAfterMain,
    };
    await playBtn.click(); // pause
  } else {
    out.steps.stemExclusion = 'no stem buttons found';
  }
} catch (e) {
  out.steps.stemExclusion = `THREW ${e.message}`;
}

out.errors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
