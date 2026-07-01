#!/usr/bin/env node
/**
 * Visual snapshot tool for iterative UI debugging.
 *
 * Loads the dev/preview server in three viewports (desktop / tablet / mobile),
 * captures full-page + above-the-fold PNGs, console/page/network errors, and DOM
 * overflow metrics. Writes everything into .snapshots/<label>/ with a summary.json,
 * then prints a report. Read the screenshots to inspect visually.
 *
 * Usage:
 *   node scripts/snapshot.mjs [--url=http://localhost:5174/]
 *                             [--label=iter-01-skeleton]
 *                             [--action=scroll-to-spectrogram|play-cleaned|load-model|mobile-gate]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? 'true'];
    })
);

const URL_TO_TEST = args.url ?? 'http://localhost:5174/';
const LABEL = args.label ?? `snap-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const ACTION = args.action ?? null;
const OUT_DIR = resolve(ROOT, '.snapshots', LABEL);
mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

/** Named pre-screenshot interaction, so we can capture dynamic states. */
async function performAction(page, name) {
  if (!name) return null;
  switch (name) {
    case 'scroll-halfway':
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(300);
      return 'Scrolled to midpoint';
    case 'scroll-bottom':
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      return 'Scrolled to bottom';
    case 'scroll-to-spectrogram': {
      const el = page.locator('#spectrogram');
      if (await el.count()) {
        await el.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        return 'Scrolled to spectrogram';
      }
      return 'spectrogram section not found';
    }
    case 'play-cleaned': {
      const btn = page.locator('[data-action="play"]').first();
      if (await btn.count()) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        await page.waitForTimeout(1200);
        return 'Clicked play';
      }
      return 'play button not found';
    }
    case 'load-model':
    case 'mobile-gate':
      // Placeholders for iteration 2 (live model path). No-op until then.
      return `${name}: not implemented in this iteration`;
    default:
      throw new Error(`Unknown action: ${name}`);
  }
}

async function capture(viewport) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: viewport.name === 'mobile',
    hasTouch: viewport.name !== 'desktop',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const networkErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r) =>
    networkErrors.push({ url: r.url(), error: r.failure()?.errorText })
  );
  page.on('response', (r) => r.status() >= 400 && networkErrors.push({ url: r.url(), status: r.status() }));

  try {
    await page.goto(URL_TO_TEST, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch (err) {
    await browser.close();
    return { viewport: viewport.name, error: `navigation failed: ${err.message}` };
  }

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // Scroll-sweep so IntersectionObserver reveal animations fire for every section,
  // then return to top — otherwise a full-page capture shows off-screen content as
  // still-hidden (opacity 0).
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);

  const actionDescription = ACTION ? await performAction(page, ACTION) : null;

  await page.screenshot({ path: resolve(OUT_DIR, `${viewport.name}-full.png`), fullPage: true });
  await page.screenshot({ path: resolve(OUT_DIR, `${viewport.name}-fold.png`), fullPage: false });

  const metrics = await page.evaluate(() => {
    const b = document.body;
    const h = document.documentElement;
    const sw = Math.max(b.scrollWidth, h.scrollWidth);
    return {
      scrollWidth: sw,
      clientWidth: h.clientWidth,
      hasHorizontalScroll: sw > h.clientWidth + 1,
      scrollHeight: Math.max(b.scrollHeight, h.scrollHeight),
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim().slice(0, 120) ?? null,
    };
  });

  await browser.close();
  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    actionDescription,
    metrics,
    consoleErrors,
    pageErrors,
    networkErrors,
  };
}

async function main() {
  console.log(`\nSnapshot: ${URL_TO_TEST}\nLabel:    ${LABEL}\nOutput:   ${OUT_DIR}`);
  if (ACTION) console.log(`Action:   ${ACTION}`);
  console.log('');

  const results = [];
  for (const vp of VIEWPORTS) {
    process.stdout.write(`  ${vp.name.padEnd(8)} (${vp.width}x${vp.height})... `);
    const r = await capture(vp);
    results.push(r);
    if (r.error) {
      console.log(`ERROR: ${r.error}`);
    } else {
      const errs = r.consoleErrors.length + r.pageErrors.length + r.networkErrors.length;
      console.log(`OK  errors=${errs}${r.metrics.hasHorizontalScroll ? ' [H-OVERFLOW]' : ''}`);
    }
  }

  writeFileSync(
    resolve(OUT_DIR, 'summary.json'),
    JSON.stringify({ url: URL_TO_TEST, label: LABEL, action: ACTION, results }, null, 2)
  );

  console.log('\n--- Report ---');
  let clean = true;
  for (const r of results) {
    if (r.error) {
      clean = false;
      console.log(`\n[${r.viewport}] ${r.error}`);
      continue;
    }
    const errs = r.consoleErrors.length + r.pageErrors.length + r.networkErrors.length;
    if (errs || r.metrics.hasHorizontalScroll) clean = false;
    console.log(`\n[${r.viewport} ${r.size}]`);
    console.log(`  scroll=${r.metrics.scrollWidth}px client=${r.metrics.clientWidth}px${r.metrics.hasHorizontalScroll ? '  OVERFLOW!' : ''}`);
    if (r.consoleErrors.length) console.log(`  console: ${r.consoleErrors.join(' | ')}`);
    if (r.pageErrors.length) console.log(`  page:    ${r.pageErrors.join(' | ')}`);
    if (r.networkErrors.length)
      console.log(`  network: ${r.networkErrors.map((e) => `${e.status ?? 'fail'} ${e.url}`).join(' | ')}`);
  }
  console.log(`\n${clean ? 'CLEAN' : 'ISSUES FOUND'} — screenshots in ${OUT_DIR}\n`);
}

main().catch((err) => {
  console.error('Snapshot failed:', err);
  process.exit(1);
});
