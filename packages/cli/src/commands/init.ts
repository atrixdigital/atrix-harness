import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { log } from '../lib/log.ts';
import { harnessVersion } from '../lib/version.ts';

/**
 * Scaffold a consuming repository.
 *
 * Only what genuinely must live inside the repo goes here: the pointer to the harness,
 * repo-specific conventions, index config, and the MCP wiring. Everything shared stays in
 * the harness so it can be updated centrally.
 *
 * The MCP wiring is not optional. AGENTS.md instructs every agent to reach for
 * `atrix_search` and `atrix_impact` before reading files; shipping that instruction
 * without the tools produces an agent that tries, fails, and falls back — worse than
 * never having promised them.
 */

const ATRIX_MCP_KEY = 'atrix-graph';

/** Merge our server into whatever the repo already has, without touching the rest. */
function wireMcp(projectRoot: string, created: string[], skipped: string[]): void {
  const file = join(projectRoot, '.mcp.json');
  const server = {
    type: 'stdio',
    command: 'bun',
    args: ['run', '${ATRIX_HOME}/packages/graph-mcp/src/server.ts'],
  };

  if (!existsSync(file)) {
    writeFileSync(file, `${JSON.stringify({ mcpServers: { [ATRIX_MCP_KEY]: server } }, null, 2)}\n`, 'utf8');
    created.push('.mcp.json');
    return;
  }

  let existing: Record<string, unknown>;
  try {
    existing = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    // Never overwrite a file we cannot parse — it may hold another team's config.
    log.warn('.mcp.json exists but is not valid JSON — add the atrix-graph server by hand');
    return;
  }

  const servers = (existing['mcpServers'] ?? existing) as Record<string, unknown>;
  if (ATRIX_MCP_KEY in servers) {
    skipped.push('.mcp.json (atrix-graph already configured)');
    return;
  }

  servers[ATRIX_MCP_KEY] = server;
  const merged = 'mcpServers' in existing ? existing : { mcpServers: servers };
  writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  created.push('.mcp.json (merged in atrix-graph)');
}

export function init(harnessRoot: string, projectRoot: string): void {
  if (harnessRoot === projectRoot) {
    log.warn('This is the harness itself — nothing to initialise.');
    return;
  }

  const created: string[] = [];
  const skipped: string[] = [];

  const put = (rel: string, contents: string): void => {
    const file = join(projectRoot, rel);
    if (existsSync(file)) {
      skipped.push(rel);
      return;
    }
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, contents, 'utf8');
    created.push(rel);
  };

  // A relative path is friendlier when the harness sits nearby, but degenerates into
  // `../../../../..` noise once the project lives elsewhere. Fall back to absolute.
  const rel = relative(projectRoot, harnessRoot);
  const harnessRel = rel === '' || rel.split(sep).filter((s) => s === '..').length > 2 ? harnessRoot : rel;
  const version = harnessVersion(harnessRoot);

  put(
    '.atrix/config.json',
    `${JSON.stringify(
      {
        // Recorded so `doctor` can tell you how far behind the shared harness you are.
        harness: { version: version.version, commit: version.commit ?? null, path: harnessRel },
        index: { include: ['src', 'app', 'packages', 'apps'], exclude: ['node_modules', 'dist', '.next'] },
        // Consecutive identical calls with an identical result. The first two levels
        // nudge; the last escalates the next repeat to the human.
        loopGuard: { thresholds: [3, 5, 8] },
        // Off by default: most Atrix repos are private client work and code chunks must
        // never leave the machine without an explicit decision.
        semantic: { provider: null },
      },
      null,
      2,
    )}\n`,
  );

  put(
    'AGENTS.md',
    `# ${basename(projectRoot)}

## Harness

This repository is operated under the Atrix harness. **Read \`${harnessRel}/AGENTS.md\` first** —
it carries the rules, methodology, recovery policy and skills that apply everywhere.

Repo-specific context below overrides the harness on conventions, never on safety.

## Stack

<!-- Runtime, framework, database, package manager. One line each. -->

## Commands

\`\`\`bash
# install
# dev
# typecheck
# test
\`\`\`

## Conventions

<!-- Only what is specific to THIS repo and not already in the harness rules.
     If you find yourself writing a general rule here, it belongs in the harness:
     run \`atrix learn\` instead. -->

## Gotchas

<!-- Things that have bitten people. Each one should have an incident behind it. -->

## How this system works

See [UNDERSTANDINGS.md](./UNDERSTANDINGS.md) — accumulated comprehension of the mechanisms,
constraints and history that the code does not state. Read it before tracing a flow from scratch,
and add to it when you work something out.
`,
  );

  put('CLAUDE.md', `# Pointer\n\nRead **[AGENTS.md](./AGENTS.md)**, then \`${harnessRel}/AGENTS.md\`.\n`);

  // Descriptive counterpart to AGENTS.md. Agents re-derive the same architecture every
  // session; this is where comprehension accumulates instead of evaporating.
  put(
    'UNDERSTANDINGS.md',
    `# Understandings — ${basename(projectRoot)}

How this codebase actually works, and why. **Descriptive, not prescriptive** — rules live in
[AGENTS.md](./AGENTS.md); this is what is already true.

Append entries; never rewrite one. When an understanding is overtaken, mark it superseded and add
a new entry — the record of what the team used to believe explains code written under that belief.

See the \`recording-understanding\` skill for when an entry is worth writing.

---

<!-- Template — copy for each entry:

## <the thing understood, as a claim>

**Date:** YYYY-MM-DD
**Confidence:** confirmed | inferred | uncertain
**From:** <file:line, or the command you ran>

<The mechanism. Then why it is that way, if you know. Then anything you ruled out —
that is the expensive part to rediscover.>

-->
`,
  );

  wireMcp(projectRoot, created, skipped);

  // The index and the trace are local-only. The trace is redacted by construction, but
  // it should still never reach a remote.
  const gitignore = join(projectRoot, '.gitignore');
  const ignoreLine = '.atrix/';
  const existing = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : '';
  if (!existing.split(/\r?\n/).some((l) => l.trim() === ignoreLine)) {
    const prefix = existing === '' || existing.endsWith('\n') ? '' : '\n';
    appendFileSync(gitignore, `${prefix}\n# atrix code graph and local trace — never committed\n${ignoreLine}\n`, 'utf8');
    created.push('.gitignore (+ .atrix/)');
  }

  for (const rel of created) log.ok(`created ${rel}`);
  for (const rel of skipped) log.detail(`kept existing ${rel}`);

  log.blank();
  log.info('Next:');
  log.detail(`1. export ATRIX_HOME="${harnessRoot}"   (the MCP server resolves it at launch)`);
  log.detail('2. atrix index                          — build the code graph');
  log.detail('3. Fill in Stack, Commands and Gotchas in AGENTS.md');
}
