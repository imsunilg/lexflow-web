#!/usr/bin/env node
// i18n completeness gate, PRD G-AC8: "Language switch en<->hi leaves zero
// hardcoded strings on the top-30 screens (pseudo-locale test)." This script
// implements the tractable, automatable half of that requirement: every
// `i18n`-marked unit extracted into the English source catalog
// (`messages.xlf`, xlf2 format) must have a corresponding `<target>` in the
// Hindi catalog (`messages.hi.xlf`) that is non-empty AND not byte-identical
// to the English source (a copy-pasted/untranslated placeholder is treated
// as a failure, exactly like a missing one).
//
// Scope note (documented, not silently assumed): this catches every string
// that WAS marked with an `i18n` attribute and extracted. It cannot detect
// static text that was never marked at all — that class of gap needs a
// rendered-DOM/pseudo-locale visual pass (swap in a locale whose "translation"
// visibly mutates every string, then screenshot/text-scan the running app),
// which is a heavier CI investment tracked as follow-up, not implemented here.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const APPS = ['staff-portal', 'client-portal'];

function parseUnits(xlfPath) {
  if (!existsSync(xlfPath)) return null;
  const xml = readFileSync(xlfPath, 'utf-8');
  const units = new Map();
  const unitRe = /<unit id="([^"]+)">([\s\S]*?)<\/unit>/g;
  let match;
  while ((match = unitRe.exec(xml))) {
    const [, id, body] = match;
    const sourceMatch = /<source>([\s\S]*?)<\/source>/.exec(body);
    const targetMatch = /<target>([\s\S]*?)<\/target>/.exec(body);
    units.set(id, {
      source: sourceMatch?.[1]?.trim() ?? '',
      target: targetMatch?.[1]?.trim() ?? null,
    });
  }
  return units;
}

let failed = false;

for (const app of APPS) {
  const localeDir = join('projects', app, 'src', 'locale');
  const sourcePath = join(localeDir, 'messages.xlf');
  const targetPath = join(localeDir, 'messages.hi.xlf');

  const sourceUnits = parseUnits(sourcePath);
  if (!sourceUnits) {
    console.error(`✗ ${app}: ${sourcePath} not found — run "npm run i18n:extract:${app}" first.`);
    failed = true;
    continue;
  }

  const targetUnits = parseUnits(targetPath) ?? new Map();
  const missing = [];
  const untranslated = [];

  for (const [id, { source }] of sourceUnits) {
    const target = targetUnits.get(id);
    if (!target || !target.target) {
      missing.push(id);
    } else if (target.target === source) {
      untranslated.push(id);
    }
  }

  console.log(`${app}: ${sourceUnits.size} i18n units in source catalog.`);

  if (missing.length > 0) {
    console.error(`✗ ${app}: ${missing.length} unit(s) missing from messages.hi.xlf:`);
    for (const id of missing) console.error(`    - ${id}`);
    failed = true;
  }

  if (untranslated.length > 0) {
    console.error(
      `✗ ${app}: ${untranslated.length} unit(s) in messages.hi.xlf are byte-identical to the English source (untranslated placeholder):`,
    );
    for (const id of untranslated) console.error(`    - ${id}`);
    failed = true;
  }

  if (missing.length === 0 && untranslated.length === 0) {
    console.log(`✓ ${app}: every extracted i18n unit has a distinct Hindi translation.`);
  }
}

process.exit(failed ? 1 : 0);
