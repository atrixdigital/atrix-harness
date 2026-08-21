#!/usr/bin/env bun
/**
 * SessionStart context loader.
 *
 * Surfaces only what changes what the agent should do right now: whether the graph
 * index is stale, and whether there are captured incidents still waiting to be
 * distilled. Everything else the agent can look up on demand — front-loading a repo
 * summary into every session is exactly the context waste `context-discipline` forbids.
 *
 * Silent when there is nothing to say.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_STALE_AFTER_HOURS = 24;

function harnessRoot(): string | undefined {
  const fromEnv = process.env.ATRIX_HOME;
  if (fromEnv !== undefined && existsSync(join(fromEnv, 'core', 'rules'))) return fromEnv;

  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'core', 'rules')) && existsSync(join(dir, 'AGENTS.md'))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const notes: string[] = [];
const root = harnessRoot();

if (root !== undefined) {
  const incidentsDir = join(root, 'learning', 'incidents');
  if (existsSync(incidentsDir)) {
    const undistilled = readdirSync(incidentsDir)
      .filter((f) => f.endsWith('.md'))
      .filter((f) => /^status:\s*captured\s*$/m.test(readFileSync(join(incidentsDir, f), 'utf8')));

    if (undistilled.length > 0) {
      notes.push(
        `${undistilled.length} captured incident(s) not yet distilled into rules — run \`atrix distill\` when you have a moment.`,
      );
    }
  }
}

const indexPath = join(process.cwd(), '.atrix', 'graph.db');
if (existsSync(indexPath)) {
  const ageHours = (Date.now() - statSync(indexPath).mtimeMs) / 3_600_000;
  if (ageHours > INDEX_STALE_AFTER_HOURS) {
    notes.push(`Code graph index is ${Math.floor(ageHours / 24)}d old — run \`atrix index\` before trusting impact queries.`);
  }
}

if (notes.length > 0) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `Atrix harness:\n${notes.map((n) => `- ${n}`).join('\n')}`,
      },
    }),
  );
}
