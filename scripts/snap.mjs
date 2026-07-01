#!/usr/bin/env node
/**
 * Quick single-shot: desktop-only screenshot for a fast look during dev.
 * For the full tri-viewport loop use scripts/snapshot.mjs.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);
const URL_TO_TEST = args.url ?? 'http://localhost:5174/';
const OUT = resolve(ROOT, '.snapshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(URL_TO_TEST, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const path = resolve(OUT, 'quick.png');
await page.screenshot({ path, fullPage: true });
await browser.close();
console.log(`Saved ${path}`);
