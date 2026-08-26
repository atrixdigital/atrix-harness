import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { log } from '../lib/log.ts';
import { harnessVersion } from '../lib/version.ts';
import { activeProject, type Project } from '../lib/workspace.ts';

/**
 * Scaffold, in two distinct modes.
 *
 * **Workspace** (run at the harness root): the MCP wiring and index config, once. The
 * graph server is workspace-wide — one server covering every project — so this belongs at
 * the root and not repeated per project.
 *
 * **Project** (run inside `projects/<name>`): the two files that belong to *that repo* and
 * are committed to it — `AGENTS.md` for its conventions and `UNDERSTANDINGS.md` for how it
 * works. Both travel with the code, so whoever clones that project gets them without
 * needing the harness.
 *
 * The MCP wiring is not optional in workspace mode. AGENTS.md instructs every agent to
 * reach for `atrix_search` before reading files; shipping that instruction without the
 * tools produces an agent that tries, fails and falls back — worse than never promising
 * them.
 */

const ATRIX_MCP_KEY = 'atrix-graph';

/** Merge our server into whatever the repo already has, without touching the rest. */
function wireMcp(workspaceRoot: string, created: string[], skipped: string[]): void {
  const file = join(workspaceRoot, '.mcp.json');
  // `.mcp.json` is local and gitignored, so an absolute path is correct here and is the
  // most robust form — no environment variable to forget. (incident-0003 was about paths
  // baked into COMMITTED adapters, which is a different thing.)
  const launcher = join(workspaceRoot, 'core', 'mcp', 'launch.ts');
  if (!existsSync(launcher)) {
    // Pointing a config at a path that is not there is how the graph was broken for
    // everyone once already; say so rather than writing it silently.
    log.warn(`graph launcher not found at ${launcher} — the graph tools will not start`);
  }

  const server = {
    type: 'stdio',
    command: 'bun',
    args: ['run', launcher],
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

export function init(workspaceRoot: string, cwd: string = process.cwd()): void {
  const project = activeProject(workspaceRoot, cwd);
  return project === undefined ? initWorkspace(workspaceRoot) : initProject(project);
}

function initProject(project: Project): void {
  const created: string[] = [];
  const skipped: string[] = [];

  const put = (rel: string, contents: string): void => {
    const file = join(project.root, rel);
    if (existsSync(file)) {
      skipped.push(rel);
      return;
    }
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, contents, 'utf8');
    created.push(rel);
  };

  put(
    'AGENTS.md',
    `# ${project.name}

Operated under the Atrix harness — the org-wide rules, methodology and skills live there and
apply here. What follows is specific to this repository, and overrides the harness on
conventions but never on safety.

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

<!-- Only what is specific to THIS repo. A general rule belongs in the harness:
     run \`atrix learn\` instead. -->

## Gotchas

<!-- Things that have bitten people here. -->

## How this system works

See [UNDERSTANDINGS.md](./UNDERSTANDINGS.md) — the mechanisms, constraints and history the code
does not state. Read it before tracing a flow from scratch; add to it when you work something out.
`,
  );

  put(
    'UNDERSTANDINGS.md',
    `# Understandings — ${project.name}

How this codebase actually works, and why. **Descriptive, not prescriptive** — rules live in
[AGENTS.md](./AGENTS.md); this is what is already true.

Append entries; never rewrite one. When an understanding is overtaken, mark it superseded and add
a new entry — the record of what the team used to believe explains code written under that belief.

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

  for (const rel of created) log.ok(`created ${project.name}/${rel}`);
  for (const rel of skipped) log.detail(`kept existing ${project.name}/${rel}`);

  log.blank();
  log.info(`These two files belong to ${project.name} and are committed to its own repo —`);
  log.detail('they travel with the code, so whoever clones it gets them without the harness.');
  log.blank();
  log.detail(`Next: atrix index --project ${project.name}`);
}

function initWorkspace(workspaceRoot: string): void {
  const created: string[] = [];
  const skipped: string[] = [];

  const put = (rel: string, contents: string): void => {
    const file = join(workspaceRoot, rel);
    if (existsSync(file)) {
      skipped.push(rel);
      return;
    }
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, contents, 'utf8');
    created.push(rel);
  };

  const version = harnessVersion(workspaceRoot);

  put(
    '.atrix/config.json',
    `${JSON.stringify(
      {
        harness: { version: version.version, commit: version.commit ?? null },
        index: { include: [], exclude: ['node_modules', 'dist', '.next'] },
        loopGuard: { thresholds: [3, 5, 8] },
        // Off by default: most Atrix repos are private client work and code chunks must
        // never leave the machine without an explicit decision.
        semantic: { provider: null },
      },
      null,
      2,
    )}\n`,
  );

  wireMcp(workspaceRoot, created, skipped);

  // The index and the trace are local-only. The trace is redacted by construction, but
  // it should still never reach a remote.
  const gitignore = join(workspaceRoot, '.gitignore');
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
  log.detail('1. git clone <repo> projects/<name>     — bring a project in');
  log.detail('2. cd projects/<name> && atrix init     — scaffold that project');
  log.detail('3. atrix index --all                    — one index across the workspace');
  log.blank();
  // The old step 1 here was "export ATRIX_HOME=…", which nobody did, and the graph then
  // silently had no tools. Discovery replaced it. See learning/incidents/incident-0009.
  log.detail('No ATRIX_HOME to export — the graph server finds the workspace itself.');
}
