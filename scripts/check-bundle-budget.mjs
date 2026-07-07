#!/usr/bin/env node
// Bundle-size budget gate, PRD §31: "initial route JS ≤ 300 KB gz
// (route-level code splitting, standalone lazy)". Parses the built index.html
// for the scripts/styles it references up front (the initial bundle, as
// opposed to lazy feature chunks) and fails if their combined gzip size
// exceeds the budget.
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET_BYTES = 300 * 1024;

const app = process.argv[2];
if (!app) {
  console.error('Usage: node scripts/check-bundle-budget.mjs <app-name> [locale]');
  process.exit(1);
}

const locale = process.argv[3];
const browserDir = locale
  ? join('dist', app, 'browser', locale)
  : join('dist', app, 'browser');

const indexPath = join(browserDir, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`Not found: ${indexPath}. Run "ng build ${app}" first.`);
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf-8');
const assetRefs = [
  ...new Set([...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1])),
];

let totalGzip = 0;
const rows = [];

for (const ref of assetRefs) {
  const assetPath = join(browserDir, ref);
  if (!existsSync(assetPath)) continue;

  const raw = readFileSync(assetPath);
  const gzipSize = gzipSync(raw, { level: 9 }).length;
  totalGzip += gzipSize;
  rows.push({ file: ref, gzipKb: (gzipSize / 1024).toFixed(2) });
}

console.table(rows);
console.log(`Total initial bundle (gzip): ${(totalGzip / 1024).toFixed(2)} KB (budget: ${(BUDGET_BYTES / 1024).toFixed(0)} KB)`);

if (totalGzip > BUDGET_BYTES) {
  console.error(`✗ ${app}: initial bundle exceeds the §31 300 KB gz budget.`);
  process.exit(1);
}

console.log(`✓ ${app}: within budget.`);
