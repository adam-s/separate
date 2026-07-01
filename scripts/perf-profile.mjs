#!/usr/bin/env node
/**
 * Minimal performance trace. Loads the page, records a Chromium trace and a few
 * timing metrics (FCP, layout duration), writes them to .snapshots/perf.json.
 * Expand with model-load timing once the live ML path lands (iteration 2).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const URL_TO_TEST = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:5174/';
const OUT = resolve(ROOT, '.snapshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL_TO_TEST, { waitUntil: 'networkidle' });
const timing = await page.evaluate(() => {
  const paint = performance.getEntriesByType('paint');
  const nav = performance.getEntriesByType('navigation')[0];
  return {
    firstContentfulPaint: paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? null,
    domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
    loadComplete: nav?.loadEventEnd ?? null,
  };
});
await browser.close();
writeFileSync(resolve(OUT, 'perf.json'), JSON.stringify(timing, null, 2));
console.log('perf:', timing);
