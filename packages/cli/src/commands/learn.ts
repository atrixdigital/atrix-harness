import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
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

function nextId(incidentsDir: string): string {
  mkdirSync(incidentsDir, { recursive: true });
  const ids = readdirSync(incidentsDir)
    .map((f) => /^incident-(\d{4})/.exec(f)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number);
  const next = ids.length === 0 ? 1 : Math.max(...ids) + 1;
  return String(next).padStart(4, '0');
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
  const id = nextId(p.incidents);
  const slug = slugify(title);
  const file = join(p.incidents, `incident-${id}-${slug}.md`);

  if (existsSync(file)) {
    log.warn(`${file} already exists — not overwriting.`);
    return file;
  }

  const template = `---
id: incident-${id}
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
  log.ok(`captured incident-${id}`);
  log.detail(file);
  log.detail('Next: fill it in, then run `atrix distill incident-' + id + '` to propose a change.');
  return file;
}
