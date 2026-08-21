import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { findIncident, listIncidents, unfilledSections } from '../lib/incidents.ts';
import { AtrixError, log } from '../lib/log.ts';
import { harnessPaths } from '../lib/paths.ts';

/**
 * Distillation stage of the learning loop.
 *
 * The CLI does not do the thinking — the agent running it does. What the CLI owns is
 * the structure: refusing to distill an incident nobody filled in, scaffolding the
 * candidate, and keeping the incident's status honest. Keeping this deterministic is
 * what makes the loop reviewable.
 */

function candidateTemplate(id: string, title: string): string {
  return `---
incident: ${id}
title: ${title}
status: proposed
---

## The generalisation

<!-- What is true beyond this one incident? If the honest answer is "nothing, this was
     a one-off", write that and set status: dismissed. Most incidents do not generalise,
     and a rule library padded with one-off workarounds is worse than a small one. -->

## Who this bites

<!-- Which repos, roles or situations. A rule that applies to one repo belongs in that
     repo's AGENTS.md, not in the shared harness. -->

## Proposed change

Target: <!-- core/rules/<name>.md | core/methodology/<name>.md | core/skills/<group>/<name>/ -->

\`\`\`diff
<!-- The actual change. New file: paste the whole thing including frontmatter with
     source: ${id}. Amendment: show the before/after. -->
\`\`\`

## Why this earns its place

<!-- Every rule costs context in every session, forever. What does this one buy that
     justifies that? If you cannot answer, the answer is dismissal. -->

## How we would know it stopped mattering

<!-- The prune condition. What would have to become true for this rule to be dead
     scaffolding? Models improve; rules that fixed model gaps expire. -->
`;
}

export function distill(harnessRoot: string, id: string | undefined): void {
  const p = harnessPaths(harnessRoot);

  if (id === undefined) {
    const captured = listIncidents(harnessRoot).incidents.filter((i) => i.meta.status === 'captured');
    if (captured.length === 0) {
      log.ok('nothing to distill — no captured incidents');
      return;
    }
    log.info(`${captured.length} incident(s) awaiting distillation:`);
    for (const incident of captured) log.detail(`${incident.meta.id}  ${incident.meta.title}`);
    log.blank();
    log.info('Run `atrix distill <id>` to start one.');
    return;
  }

  const incident = findIncident(harnessRoot, id);
  if (incident === undefined) {
    throw new AtrixError(`No incident "${id}".`, 'Run `atrix distill` with no argument to list them.');
  }

  if (incident.meta.status !== 'captured') {
    throw new AtrixError(
      `${id} is already ${incident.meta.status}.`,
      'Only captured incidents can be distilled. Edit the candidate directly instead.',
    );
  }

  const unfilled = unfilledSections(incident.body);
  if (unfilled.length > 0) {
    throw new AtrixError(
      `${id} is not filled in — ${unfilled.join(', ')} ${unfilled.length === 1 ? 'is' : 'are'} empty.`,
      `Write up what happened in ${incident.file} first. A rule distilled from an empty incident cannot be justified later.`,
    );
  }

  const file = join(p.candidates, `${id}.md`);
  if (existsSync(file)) {
    throw new AtrixError(`A candidate for ${id} already exists.`, file);
  }

  writeFileSync(file, candidateTemplate(id, incident.meta.title), 'utf8');

  // Status moves only once the candidate exists, so an interrupted run leaves the
  // incident distillable rather than stranded. Rewrite from the raw file — `body`
  // excludes the frontmatter the status lives in.
  const raw = readFileSync(incident.file, 'utf8');
  writeFileSync(incident.file, raw.replace(/^status:\s*captured\s*$/m, 'status: distilled'), 'utf8');

  log.ok(`drafted candidate for ${id}`);
  log.detail(file);
  log.blank();
  log.info('Next:');
  log.detail(`1. Fill in ${basename(file)} — the generalisation, the diff, and the prune condition`);
  log.detail('2. Apply the change under core/, then run `atrix build`');
  log.detail('3. Open a PR. Learned changes are always human-reviewed before they reach every repo');
}
