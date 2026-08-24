#!/usr/bin/env bun
/**
 * SessionStart context, and the rule bundle.
 *
 * Claude Code plugins ship skills, agents, hooks and MCP servers — **not rule files**.
 * The bundle this repo generates into the plugin was never loaded by anything: a live
 * session asked for the bounded-recovery levels and answered "NOT LOADED", while Codex
 * and Gemini, which read the bundle file directly, had every rule.
 *
 * `additionalContext` is the mechanism that closes it. The rules ride the same payload as
 * the situational notes below, so a Claude session pays the same always-on cost for the
 * same content as every other agent — which is what "org-wide rules" has to mean.
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
import { clusterFailures, describeCluster, readTrace } from './lib/trace.ts';

const INDEX_STALE_HOURS = 24;

/**
 * The generated bundle, shipped beside this hook inside the plugin.
 *
 * Passed as argv rather than read from the environment: `${CLAUDE_PLUGIN_ROOT}` is
 * expanded by the runtime when it builds the command, which is a guarantee, where the
 * variable surviving into the child process is an assumption.
 */
function ruleBundle(): string | undefined {
  const pluginRoot = process.argv[2];
  if (pluginRoot === undefined || pluginRoot === '') return undefined;

  const path = join(pluginRoot, 'AGENTS.md');
  if (!existsSync(path)) return undefined;

  try {
    const text = readFileSync(path, 'utf8').trim();
    return text === '' ? undefined : text;
  } catch {
    // A session without the rules is degraded but workable; one that fails to start
    // is not. Never let this be the thing that breaks a session.
    return undefined;
  }
}

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
/** The workspace, when we are inside one; otherwise treat cwd as the whole world. */
const workspace = harnessRoot() ?? projectRoot;
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

// — A failure the agent is about to repeat. `atrix observe` exists and nobody remembers
//   to run it; surfacing the worst pattern here is the whole point of recording a trace.
try {
  const clusters = clusterFailures(readTrace(workspace));
  const worst = clusters[0];
  if (worst !== undefined) {
    notes.push(
      `A failure has recurred ${worst.count} times across ${worst.days} day(s): ${describeCluster(worst).slice(0, 140)}. ` +
        'If you hit it again it is a standing problem rather than bad luck — `atrix observe` has the detail.',
    );
  }
} catch {
  // Never let trace bookkeeping delay a session.
}

// — A project nobody has onboarded. The agent can do the whole thing itself, but only
//   if it knows there is something to do; a developer who cloned a repo an hour ago has
//   no reason to suspect the graph tools cannot see it.
try {
  const projectsDir = join(workspace, 'projects');
  if (existsSync(projectsDir)) {
    const unonboarded = readdirSync(projectsDir).filter(
      (name) =>
        !name.startsWith('.') &&
        statSync(join(projectsDir, name)).isDirectory() &&
        !existsSync(join(projectsDir, name, 'AGENTS.md')),
    );

    if (unonboarded.length > 0) {
      notes.push(
        `${unonboarded.join(', ')} ${unonboarded.length === 1 ? 'is' : 'are'} in projects/ but not onboarded — ` +
          'no AGENTS.md, and the graph tools cannot see the code. Offer to set it up: the ' +
          '`onboarding-a-project` skill covers it end to end.',
      );
    }
  }
} catch {
  // A projects directory we cannot read is not worth failing a session over.
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

// — Harness state: unfinished learning.
{
  const incidents = join(workspace, 'learning', 'incidents');
  if (existsSync(incidents)) {
    const captured = readdirSync(incidents)
      .filter((f) => f.endsWith('.md'))
      .filter((f) => /^status:\s*captured\s*$/m.test(readFileSync(join(incidents, f), 'utf8')));
    if (captured.length > 0) {
      notes.push(`${captured.length} captured incident(s) still to distil — \`atrix distill\` when there is a moment.`);
    }
  }
}

const bundle = ruleBundle();

// Rules first, situational notes after. The bundle is byte-identical between sessions,
// so it sits in the cacheable prefix; the notes vary per session and belong below it.
// See core/rules/cache-shape.md — ordering this the other way costs a full uncached
// prefix on every turn.
const sections: string[] = [];
if (bundle !== undefined) sections.push(bundle);
if (notes.length > 0) {
  sections.push(`## Right now\n\nThings worth knowing before you start:\n${notes.map((n) => `- ${n}`).join('\n')}`);
}

if (sections.length > 0) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: sections.join('\n\n---\n\n') },
    }),
  );
}
