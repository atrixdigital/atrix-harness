#!/usr/bin/env bun
/**
 * Export one PNG per slide, numbered, for Instagram and X.
 *
 * LinkedIn takes a single PDF (`--print-to-pdf`); Instagram takes individual images and
 * orders them by filename, which is why these are zero-padded.
 *
 * Each slide is rendered on its own by hiding the others, rather than cropping a tall
 * screenshot — cropping drifts by a pixel per slide and the drift is invisible until the
 * set is posted.
 *
 *   bun run export-slides.ts carousel.html out/ [--size 1080x1350]
 */

import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const [input, outDir = 'out'] = process.argv.slice(2);
if (input === undefined) {
  console.error('usage: bun run export-slides.ts <carousel.html> [outDir] [--size WxH]');
  process.exit(1);
}

const sizeArg = process.argv.find((a) => a.startsWith('--size='))?.split('=')[1] ?? '1080x1350';
const [w, h] = sizeArg.split('x').map(Number);
if (!w || !h) {
  console.error(`bad --size ${sizeArg} — expected WxH, e.g. 1080x1350`);
  process.exit(1);
}

const html = readFileSync(input, 'utf8');
// Count CLOSING tags. Counting `<section` matched the phrase "<section>" inside the
// template's own CSS comment and produced one blank slide at the end — which exports
// without error and is only visible if you look at the files.
const count = (html.match(/<\/section>/g) ?? []).length;
if (count === 0) {
  console.error(`no <section> elements in ${input} — nothing to export`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const tmp = resolve(outDir, '.slide.html');

for (let i = 0; i < count; i += 1) {
  // Show exactly one slide, flush against the corner, with no preview gutter.
  const isolate = `<style>
    html,body{margin:0;padding:0;background:transparent}
    section{display:none!important;margin:0!important}
    section:nth-of-type(${i + 1}){display:flex!important}
  </style>`;
  writeFileSync(tmp, html + isolate, 'utf8');

  const name = join(outDir, `${String(i + 1).padStart(2, '0')}.png`);
  const proc = Bun.spawnSync(
    [
      CHROME,
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      // Not optional: without it Chrome shoots before the webfonts land and
      // substitutes silently — a wrong-looking slide with no error.
      '--virtual-time-budget=12000',
      `--window-size=${w},${h}`,
      `--screenshot=${name}`,
      `file://${resolve(tmp)}`,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  if (proc.exitCode !== 0) {
    console.error(`slide ${i + 1} failed:\n${proc.stderr.toString().split('\n').slice(0, 3).join('\n')}`);
    process.exit(1);
  }
  console.log(`  ${name}  ${w}×${h}`);
}

rmSync(tmp, { force: true });
console.log(`\n${count} slide(s) → ${outDir}/`);
console.log('Now LOOK at them, and shrink slide 1 to thumbnail size before posting.');
