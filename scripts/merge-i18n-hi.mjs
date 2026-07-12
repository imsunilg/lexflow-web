#!/usr/bin/env node
// Merges per-module Hindi-translation JSON maps (id -> translated string,
// produced by parallel translation passes) into a full XLIFF 2.0
// `messages.hi.xlf`, using `messages.xlf` (the English source, freshly
// extracted via `ng extract-i18n`) as the authoritative list of unit ids.
// Any source unit without a matching translation is carried over untranslated
// (flagged at the end) rather than silently dropped, so `i18n:check` can
// report exactly what's still missing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const app = process.argv[2];
const jsonPaths = process.argv.slice(3);
if (!app || jsonPaths.length === 0) {
  console.error('Usage: node scripts/merge-i18n-hi.mjs <app-name> <json-file...>');
  process.exit(1);
}

const localeDir = join('projects', app, 'src', 'locale');
const sourcePath = join(localeDir, 'messages.xlf');
const targetPath = join(localeDir, 'messages.hi.xlf');

const sourceXml = readFileSync(sourcePath, 'utf-8');

const translations = new Map();
for (const jsonPath of jsonPaths) {
  if (!existsSync(jsonPath)) {
    console.error(`Skipping missing file: ${jsonPath}`);
    continue;
  }
  const map = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  for (const [id, value] of Object.entries(map)) {
    if (translations.has(id)) {
      console.error(`Duplicate translation for id "${id}" — keeping the first one seen.`);
      continue;
    }
    translations.set(id, value);
  }
}

// Carry over any existing hand-written targets (e.g. shell.* entries added
// before this merge pipeline existed) so a re-run never regresses them.
const existing = new Map();
if (existsSync(targetPath)) {
  const existingXml = readFileSync(targetPath, 'utf-8');
  const unitRe = /<unit id="([^"]+)">([\s\S]*?)<\/unit>/g;
  let m;
  while ((m = unitRe.exec(existingXml))) {
    const targetMatch = /<target>([\s\S]*?)<\/target>/.exec(m[2]);
    if (targetMatch) existing.set(m[1], targetMatch[1]);
  }
}

const unitRe = /<unit id="([^"]+)">([\s\S]*?)<\/unit>/g;
let match;
const outUnits = [];
const missing = [];

while ((match = unitRe.exec(sourceXml))) {
  const [, id, body] = match;
  const sourceMatch = /<source>([\s\S]*?)<\/source>/.exec(body);
  const source = sourceMatch[1];
  const target = translations.get(id) ?? existing.get(id);

  if (!target) {
    missing.push(id);
    outUnits.push(`    <unit id="${id}">\n      <segment>\n        <source>${source}</source>\n      </segment>\n    </unit>`);
  } else {
    outUnits.push(
      `    <unit id="${id}">\n      <segment>\n        <source>${source}</source>\n        <target>${target}</target>\n      </segment>\n    </unit>`,
    );
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en" trgLang="hi">
  <file id="ngi18n" original="ng.template">
${outUnits.join('\n')}
  </file>
</xliff>
`;

writeFileSync(targetPath, xml, 'utf-8');
console.log(`Wrote ${targetPath} with ${outUnits.length} units (${missing.length} still untranslated).`);
if (missing.length > 0) {
  console.log('Untranslated ids:');
  for (const id of missing) console.log(`  - ${id}`);
}
