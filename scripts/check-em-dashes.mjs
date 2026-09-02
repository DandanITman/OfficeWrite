#!/usr/bin/env node
/**
 * Fail the build if an em dash reappears in authored text.
 *
 * The project deliberately writes without them. They were removed from every
 * comment, document, UI string and page of the site, and the search snippet
 * Google prints is the reason: an em dash there reads as machine-written. A
 * grep-style check is the only thing that keeps that decision from decaying one
 * pull request at a time.
 *
 * Only tracked files are scanned, which is why `git ls-files` does the walking
 * rather than `readdir`: `docs/app` is a build artifact and `node_modules` is
 * not ours, and neither should ever fail this.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Built from its code point rather than written out.
 *
 * This file is tracked, so a literal here would make the check fail on itself
 * the moment it was committed. Which it did.
 */
const EM_DASH = String.fromCharCode(0x2014);

/**
 * Files where the character is data rather than prose. Removing it from these
 * would take a feature away instead of tidying the writing, so each one is
 * listed with the reason it is exempt.
 */
const ALLOWED = new Map([
  [
    'apps/desktop/src/constants/symbols.ts',
    'the em dash the Symbol picker offers the user to insert',
  ],
  [
    'packages/core/src/proofing.ts',
    "the AutoCorrect rule turning \"--\" into an em dash, and the dash characters that mark an opening smart quote",
  ],
  [
    'packages/openxml/src/rtfImport.test.ts',
    'asserts an em dash survives an RTF import',
  ],
]);

/** Binary and generated files have no authored prose to check. */
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.docx', '.exe', '.pdf', '.webm', '.mp4',
]);

const SKIP_FILES = new Set(['package-lock.json']);

function trackedFiles() {
  const result = spawnSync('git', ['ls-files'], { encoding: 'utf-8' });
  if (result.status !== 0) {
    console.error('Could not list tracked files. Is this a git checkout?');
    process.exit(1);
  }
  return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

const offences = [];
let scanned = 0;

for (const file of trackedFiles()) {
  if (ALLOWED.has(file)) continue;
  if (SKIP_FILES.has(path.basename(file))) continue;
  if (SKIP_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;

  let text;
  try {
    text = fs.readFileSync(file, 'utf-8');
  } catch {
    continue; // deleted between listing and reading, or unreadable
  }
  scanned += 1;
  if (!text.includes(EM_DASH)) continue;

  text.split('\n').forEach((line, index) => {
    if (line.includes(EM_DASH)) {
      offences.push({ file, line: index + 1, text: line.trim() });
    }
  });
}

if (offences.length === 0) {
  console.log(`No em dashes in ${scanned} tracked files.`);
  process.exit(0);
}

console.error(`Found ${offences.length} em dash(es) in authored text:\n`);
for (const offence of offences) {
  console.error(`  ${offence.file}:${offence.line}`);
  console.error(`    ${offence.text.slice(0, 120)}`);
}
console.error(`
Use ordinary punctuation instead: a colon where the dash introduces an
explanation, a comma where it brackets an aside, a full stop where it joins two
sentences. In code comments a spaced hyphen is fine.

If the character is genuinely data rather than prose, add the file to ALLOWED in
scripts/check-em-dashes.mjs with the reason.
`);
process.exit(1);
