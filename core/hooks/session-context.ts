#!/usr/bin/env bun
/**
 * SessionStart context.
 *
 * Harness-Bench's first recommendation for harness designers is **execution legibility**:
 * make pending obligations, observed evidence and recoverable failures explicit rather
 * than leaving them to be rediscovered. This hook is the one place that can do it before
 * an agent starts work.
 *
 * It previously reported almost nothing and was, by this repo's own standard, dead
 * scaffolding sitting on the highest-value surface available.
 *
 * The discipline it keeps: **only facts that change what the agent should do next.** A
 * session-start banner that recites repo statistics trains people to skip it, and then the
 * one line that mattered gets skipped too. Silent is the correct default.
 */

import { Database } from 'bun:sqlite';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const INDEX_STALE_HOURS = 24;
/** Below this a repeated failure is an incident, not a standing problem. */
const MIN_RECURRENCE = 3;

function findUp(marker: string, from: string): string | undefined {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, marker))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function harnessRoot(): string | undefined {
  const fromEnv = process.env.ATRIX_HOME;
  if (fromEnv !== undefined && existsSync(join(fromEnv, 'core', 'rules'))) return fromEnv;
  const found = findUp(join('core', 'rules'), process.cwd());
  return found !== undefined && existsSync(join(found, 'AGENTS.md')) ? found : undefined;
}

const notes: string[] = [];
const projectRoot = process.cwd();
const atrix = join(projectRoot, '.atrix');

// — Configuration that can silently point a tool at the wrong system. Read from the
//   cached analysis rather than recomputed; a hook has no budget for a TS Program.
const dbPath = join(atrix, 'graph.db');
if (existsSync(dbPath)) {
  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .query<{ kind: string; name: string }, []>(
          "SELECT kind, name FROM env_findings WHERE kind IN ('conflicting', 'client-exposed-secret')",
        )
        .all();

      const conflicting = rows.filter((r) => r.kind === 'conflicting').map((r) => r.name);
      const exposed = rows.filter((r) => r.kind === 'client-exposed-secret').map((r) => r.name);

      if (conflicting.length > 0) {
        notes.push(
          `${conflicting.join(', ')} ${conflicting.length === 1 ? 'is' : 'are'} defined in more than one env file with different values. ` +
            'Whichever file the running tool loads decides which system it talks to — confirm the target before any command that writes.',
        );
      }
      if (exposed.length > 0) {
        notes.push(`${exposed.join(', ')} looks like a secret behind a public prefix — it ships to the browser bundle.`);
      }
    } finally {
      db.close();
    }
  } catch {
    // A missing table or a locked database must never delay a session.
  }
}

// — A failure the agent is about to repeat. `atrix observe` exists, and nobody remembers
//   to run it; surfacing the top pattern here is the whole point of recording the trace.
const tracePath = join(atrix, 'trace.jsonl');
if (existsSync(tracePath)) {
  try {
    const counts = new Map<string, { count: number; days: Set<string> }>();
    for (const line of readFileSync(tracePath, 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      const record = JSON.parse(line) as { ok: boolean; tool: string; program?: string; signature?: string; date: string };
      if (record.ok || record.signature === undefined) continue;
      const key = `${record.program ?? record.tool}: ${record.signature}`;
      const entry = counts.get(key) ?? { count: 0, days: new Set<string>() };
      entry.count += 1;
      entry.days.add(record.date);
      counts.set(key, entry);
    }

    const worst = [...counts.entries()]
      .filter(([, v]) => v.count >= MIN_RECURRENCE)
      .sort(([, a], [, b]) => b.days.size - a.days.size || b.count - a.count)[0];

    if (worst !== undefined) {
      notes.push(
        `A failure has recurred here ${worst[1].count} times across ${worst[1].days.size} day(s): ${worst[0].slice(0, 120)}. ` +
          'If you hit it again, it is a standing problem rather than bad luck — `atrix observe` has the detail.',
      );
    }
  } catch {
    // A partially-written trace line is normal; never let it block a session.
  }
}

// — Index freshness, because impact answers are only as current as the index.
if (existsSync(dbPath)) {
  const ageHours = (Date.now() - statSync(dbPath).mtimeMs) / 3_600_000;
  if (ageHours > INDEX_STALE_HOURS) {
    notes.push(`The code graph is ${Math.floor(ageHours / 24)} day(s) old — run \`atrix index\` before trusting impact queries.`);
  }
} else if (existsSync(join(projectRoot, '.atrix'))) {
  notes.push('No code graph in this repo yet — run `atrix index` to enable the graph tools.');
}

// — Harness state: unfinished learning, and how far this checkout has drifted.
const root = harnessRoot();
if (root !== undefined) {
  const incidents = join(root, 'learning', 'incidents');
  if (existsSync(incidents)) {
    const captured = readdirSync(incidents)
      .filter((f) => f.endsWith('.md'))
      .filter((f) => /^status:\s*captured\s*$/m.test(readFileSync(join(incidents, f), 'utf8')));
    if (captured.length > 0) {
      notes.push(`${captured.length} captured incident(s) still to distil — \`atrix distill\` when there is a moment.`);
    }
  }
}

if (notes.length > 0) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `Atrix harness — things worth knowing before you start:\n${notes.map((n) => `- ${n}`).join('\n')}`,
      },
    }),
  );
}
