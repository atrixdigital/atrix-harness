import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { log } from '../lib/log.ts';
import { harnessPaths } from '../lib/paths.ts';

/**
 * Capture stage of the learning loop.
 *
 * An incident is raw: what happened, what it cost, what the fix was. Distillation
 * into a rule or skill change is a separate, reviewed step — conflating the two is
 * how you end up with a rule library full of one-off workarounds.
 */

/**
 * Date plus slug rather than a sequence number.
 *
 * Several developers share this repo. Two of them capturing an incident on the same
 * afternoon both compute "the next free number" and both write incident-0006 — a git
 * conflict in the one directory whose purpose is collecting independent notes.
 */
function incidentId(date: string, slug: string): string {
  return `incident-${date}-${slug}`;
}

const SLUG_MAX = 48;

function slugify(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .filter((w) => w !== '');

  // Truncate on a word boundary — a slug cut mid-word reads as corruption.
  const kept: string[] = [];
  let length = 0;
  for (const word of words) {
    const next = length === 0 ? word.length : length + 1 + word.length;
    if (next > SLUG_MAX && kept.length > 0) break;
    kept.push(word);
    length = next;
  }

  return kept.join('-') || 'untitled';
}

export function learn(harnessRoot: string, title: string, date: string): string {
  const p = harnessPaths(harnessRoot);
  mkdirSync(p.incidents, { recursive: true });

  const slug = slugify(title);
  const id = incidentId(date, slug);
  const file = join(p.incidents, `${id}.md`);

  if (existsSync(file)) {
    log.warn(`${file} already exists — not overwriting.`);
    return file;
  }

  const template = `---
id: ${id}
title: ${title}
date: ${date}
status: captured
cost: unknown
---

## What happened

<!-- The observable failure. Concrete: the command, the error, the wrong output. -->

## Why it happened

<!-- Root cause, not the symptom. If you don't know yet, say so. -->

## What fixed it

<!-- The actual fix. Paste the diff or the command. -->

## What the system should learn

<!-- The generalisable part. This becomes a rule, a skill change, or nothing.
     "Nothing" is a valid and common answer — not every incident generalises. -->

## Proposed change

- [ ] New or amended rule in \`core/rules/\`
- [ ] New or amended skill in \`core/skills/\`
- [ ] Nothing — one-off, recorded for the record
`;

  writeFileSync(file, template, 'utf8');
  log.ok(`captured ${id}`);
  log.detail(file);
  log.detail(`Next: fill it in, then run \`atrix distill ${id}\` to propose a change.`);
  return file;
}
