#!/usr/bin/env bun
/**
 * Launcher for the graph MCP server.
 *
 * The config used to point straight at `${ATRIX_HOME}/packages/graph-mcp/src/server.ts`.
 * With ATRIX_HOME unset — which is the default, because `atrix init` only *printed* the
 * export as a suggested next step — that resolved to `/packages/graph-mcp/...` and bun
 * failed with "Module not found" before any of our code ran. The agent saw no graph tools
 * and no error: the seven tools simply did not exist.
 *
 * So resolution happens here, in order, and a failure says what to do about it.
 * See learning/incidents/incident-0009.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** A directory is the harness when it holds both markers. */
function isHarness(dir: string): boolean {
  return (
    existsSync(join(dir, 'core', 'rules')) && existsSync(join(dir, 'packages', 'graph-mcp', 'src', 'server.ts'))
  );
}

function walkUp(from: string): string | undefined {
  let dir = resolve(from);
  for (;;) {
    if (isHarness(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function resolveHarness(): string | undefined {
  // 1 — explicit, honoured first so an override still works.
  const fromEnv = process.env['ATRIX_HOME'];
  if (fromEnv !== undefined && fromEnv !== '' && isHarness(fromEnv)) return fromEnv;

  // 2 — the working directory. This is the normal case: an engineer working inside the
  //     workspace or any project under it, with no environment variable at all.
  const fromCwd = walkUp(process.cwd());
  if (fromCwd !== undefined) return fromCwd;

  // 3 — this file's own location, for a plugin installed in place rather than cached.
  return walkUp(import.meta.dir);
}

const root = resolveHarness();

if (root === undefined) {
  // stderr, because stdout is the MCP transport — anything else there is a protocol error.
  process.stderr.write(
    [
      'atrix-graph: could not locate the harness.',
      '',
      'Looked at $ATRIX_HOME, then walked up from the working directory and from this file.',
      'A directory counts as the harness when it holds core/rules and packages/graph-mcp.',
      '',
      'Fix: run the agent from inside the workspace, or set ATRIX_HOME persistently:',
      '  echo \'export ATRIX_HOME="/path/to/atrix-harness"\' >> ~/.zshrc && exec zsh',
      '',
      'Then confirm with `atrix doctor`.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

process.env['ATRIX_HOME'] = root;
await import(join(root, 'packages', 'graph-mcp', 'src', 'server.ts'));
